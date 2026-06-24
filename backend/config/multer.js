/**
 * config/multer.js
 * Multer storage and filter configuration for applicant document uploads
 * and admin avatar uploads.
 *
 * CHANGES FROM ORIGINAL:
 *   - Added 'avatar' key to DEST_MAP (→ uploads/admin/)
 *   - Added 'avatar' key to ALLOWED_MIMES
 *   - Added uploadAdminAvatar multer instance (.single('avatar'))
 *   - Exported uploadAdminAvatar
 */

'use strict';

const multer             = require('multer');
const path               = require('path');
const fs                 = require('fs');
const { v4: uuidv4 }    = require('uuid');

// ── Upload directories ────────────────────────────────────────────────────────
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || './uploads');

const DEST_MAP = {
  portrait: path.join(UPLOAD_ROOT, 'portraits'),
  passport: path.join(UPLOAD_ROOT, 'passports'),
  idcard:   path.join(UPLOAD_ROOT, 'idcards'),
  admin:    path.join(UPLOAD_ROOT, 'admin'),
  avatar:   path.join(UPLOAD_ROOT, 'admin'), // 'avatar' field → same dir as 'admin'
};

Object.values(DEST_MAP).forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

// ── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_MIMES = {
  portrait: ['image/jpeg', 'image/png', 'image/webp'],
  passport: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  idcard:   ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  admin:    ['image/jpeg', 'image/png', 'image/webp'],
  avatar:   ['image/jpeg', 'image/png', 'image/webp'],
};

// ── File extensions from MIME types ──────────────────────────────────────────
const MIME_EXTENSIONS = {
  'image/jpeg':      '.jpg',
  'image/png':       '.png',
  'image/webp':      '.webp',
  'application/pdf': '.pdf',
};

// ── Max file size ─────────────────────────────────────────────────────────────
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10); // 5 MB

// ── Disk storage engine ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const dir = DEST_MAP[file.fieldname] || UPLOAD_ROOT;
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext  = MIME_EXTENSIONS[file.mimetype] || path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

// ── File filter ───────────────────────────────────────────────────────────────
function fileFilter(req, file, cb) {
  const allowed = ALLOWED_MIMES[file.fieldname];
  if (!allowed) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
  }
  if (!allowed.includes(file.mimetype)) {
    const err = new Error(
      `Invalid file type for ${file.fieldname}. Allowed: ${allowed.join(', ')}`
    );
    err.status = 400;
    return cb(err);
  }
  cb(null, true);
}

// ── Multer instances ──────────────────────────────────────────────────────────

/** Upload all three document types in one request */
const uploadDocuments = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } })
  .fields([
    { name: 'portrait', maxCount: 1 },
    { name: 'passport', maxCount: 1 },
    { name: 'idcard',   maxCount: 1 },
  ]);

/** Upload a single portrait only */
const uploadPortrait = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } })
  .single('portrait');

/** Upload a single document (passport OR idcard) */
const uploadSingleDoc = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } })
  .single('document');

/** Upload a single admin avatar (field name: 'avatar') */
const uploadAdminAvatar = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE } })
  .single('avatar');

// ── Utility: resolve public URL from stored absolute path ─────────────────────
function fileUrl(filePath) {
  if (!filePath) return null;
  const relative = filePath.replace(UPLOAD_ROOT, '').replace(/\\/g, '/');
  return `/uploads${relative}`;
}

// ── Utility: delete a file from disk ─────────────────────────────────────────
function deleteFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error('[deleteFile] Could not remove:', filePath, err.message);
  }
}

module.exports = {
  uploadDocuments,
  uploadPortrait,
  uploadSingleDoc,
  uploadAdminAvatar,   // ← NEW export
  fileUrl,
  deleteFile,
  UPLOAD_ROOT,
};