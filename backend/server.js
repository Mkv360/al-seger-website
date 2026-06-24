/**
 * server.js
 * Al-Seger Recruitment Management System — Express API Server
 *
 * CHANGES FROM ORIGINAL:
 *   - Added profileRoutes import
 *   - Mounted /api/profile
 *   - Removed duplicate app.use('/api/applications', applicationRoutes) (was mounted twice)
 */

'use strict';

require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const path      = require('path');
const rateLimit = require('express-rate-limit');

const { testConnection }          = require('./config/db');
const { errorHandler, notFound }  = require('./middleware/errorHandler');

// ── Route modules ─────────────────────────────────────────────────────────────
const authRoutes              = require('./routes/authRoutes');
const applicantRoutes         = require('./routes/applicantRoutes');
const applicationRoutes       = require('./routes/applicationRoutes');
const countryRoutes           = require('./routes/countryRoutes');
const settingsRoutes          = require('./routes/settingsRoutes');
const reportRoutes            = require('./routes/reportRoutes');
const userAuthRoutes          = require('./routes/userAuthRoutes');
const onlineApplicationRoutes = require('./routes/onlineApplicationRoutes');
const profileRoutes           = require('./routes/profileRoutes'); // ← NEW
const adminManagementRoutes = require('./routes/adminManagementRoutes');
const app  = express();
const PORT = process.env.PORT || 5000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin(origin, callback) {
    const whitelist = [
      process.env.FRONTEND_URL || 'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
      'http://localhost:5000',
    ];
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else if (process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Global rate limiting ──────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs:        parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max:             parseInt(process.env.RATE_LIMIT_MAX       || '100',    10),
  standardHeaders: true,
  legacyHeaders:   false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
}));

// ── Request parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// ── HTTP request logger ───────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Static file serving (uploaded documents) ─────────────────────────────────
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
app.use('/uploads', express.static(uploadDir, {
  setHeaders(res) {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
  },
}));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status:  'healthy',
    service: 'al-seger-api',
    version: require('./package.json').version,
    time:    new Date().toISOString(),
    env:     process.env.NODE_ENV || 'development',
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',                authRoutes);
app.use('/api/users',               userAuthRoutes);
app.use('/api/applicants',          applicantRoutes);
app.use('/api/applications',        applicationRoutes); // single mount (duplicate removed)
app.use('/api/countries',           countryRoutes);
app.use('/api/settings',            settingsRoutes);
app.use('/api/reports',             reportRoutes);
app.use('/api/online-applications', onlineApplicationRoutes);
app.use('/api/profile',             profileRoutes); // ← NEW
app.use('/api/admin-management', adminManagementRoutes);
// ── Messages routes (inline) ──────────────────────────────────────────────────
const { authenticate } = require('./middleware/adminAuth');
const { query }        = require('./config/db');

const msgRouter = express.Router();
msgRouter.use(authenticate);

msgRouter.get('/', async (req, res, next) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  || '1',  10));
    const limit  = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const offset = (page - 1) * limit;
    const unread = req.query.unread === 'true';
    const where  = unread ? 'WHERE is_read = 0' : '';
    const [rows, total] = await Promise.all([
      query(`SELECT * FROM messages ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]),
      query(`SELECT COUNT(*) AS cnt FROM messages ${where}`),
    ]);
    res.json({ success: true, data: rows, total: total[0]?.cnt || 0, page, limit });
  } catch (e) { next(e); }
});

msgRouter.get('/:id', async (req, res, next) => {
  try {
    const msg = await query('SELECT * FROM messages WHERE id = ? LIMIT 1', [req.params.id]);
    if (!msg[0]) return res.status(404).json({ success: false, message: 'Message not found.' });
    res.json({ success: true, data: msg[0] });
  } catch (e) { next(e); }
});

msgRouter.post('/', async (req, res, next) => {
  try {
    const { sender_name, sender_email, sender_phone, subject, body: msgBody, applicant_id } = req.body;
    if (!msgBody) return res.status(400).json({ success: false, message: 'Message body is required.' });
    const r = await query(
      `INSERT INTO messages (sender_name, sender_email, sender_phone, subject, body, applicant_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sender_name || null, sender_email || null, sender_phone || null,
       subject || null, msgBody, applicant_id || null]
    );
    res.status(201).json({ success: true, message: 'Message created.', data: { id: r.insertId } });
  } catch (e) { next(e); }
});

msgRouter.patch('/:id/read', async (req, res, next) => {
  try {
    await query('UPDATE messages SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Marked as read.' });
  } catch (e) { next(e); }
});

msgRouter.post('/:id/reply', async (req, res, next) => {
  try {
    const { reply_body } = req.body;
    if (!reply_body) return res.status(400).json({ success: false, message: 'reply_body is required.' });
    await query(
      `UPDATE messages SET is_replied = 1, reply_body = ?, replied_by = ?, replied_at = NOW(), is_read = 1
       WHERE id = ?`,
      [reply_body, req.admin.id, req.params.id]
    );
    res.json({ success: true, message: 'Reply sent.' });
  } catch (e) { next(e); }
});

msgRouter.delete('/:id', async (req, res, next) => {
  try {
    await query('DELETE FROM messages WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Message deleted.' });
  } catch (e) { next(e); }
});

app.use('/api/messages', msgRouter);

// ── Training routes (inline) ──────────────────────────────────────────────────
const trainingRouter = express.Router();
trainingRouter.use(authenticate);

trainingRouter.get('/', async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT t.*, a.name AS created_by_name
       FROM training_materials t LEFT JOIN admins a ON t.created_by = a.id
       WHERE t.is_active = 1 ORDER BY t.category, t.title`
    );
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
});

trainingRouter.post('/', async (req, res, next) => {
  try {
    const { title, description, category, file_type, external_url } = req.body;
    if (!title) return res.status(400).json({ success: false, message: 'title is required.' });
    const r = await query(
      `INSERT INTO training_materials (title, description, category, file_type, external_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, description || null, category || null, file_type || null, external_url || null, req.admin.id]
    );
    res.status(201).json({ success: true, data: { id: r.insertId } });
  } catch (e) { next(e); }
});

trainingRouter.delete('/:id', async (req, res, next) => {
  try {
    await query('UPDATE training_materials SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Material removed.' });
  } catch (e) { next(e); }
});

app.use('/api/training', trainingRouter);

// ── 404 & error handlers ──────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
async function startServer() {
  await testConnection();
  app.listen(PORT, () => {
    console.log(`\n🚀  Al-Seger API running`);
    console.log(`   ├─ URL:  http://localhost:${PORT}`);
    console.log(`   ├─ ENV:  ${process.env.NODE_ENV || 'development'}`);
    console.log(`   └─ DB:   ${process.env.DB_NAME}@${process.env.DB_HOST}\n`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

module.exports = app;