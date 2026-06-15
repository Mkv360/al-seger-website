/**
 * config/multer.js
 * Multer storage and filter configuration for applicant document uploads.
 * Handles portrait photos, passport scans, and national ID card images.
 */

'use strict';

const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const { v4: uuidv4 } = require('uuid');

// ── Upload directories ────────────────────────────────────────────────────────
const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || './uploads');

const DEST_MAP = {
  portrait: path.join(UPLOAD_ROOT, 'portraits'),
  passport: path.join(UPLOAD_ROOT, 'passports'),
  idcard:   path.join(UPLOAD_ROOT, 'idcards'),
};

// Ensure all upload directories exist
Object.values(DEST_MAP).forEach((dir) => {
  fs.mkdirSync(dir, { recursive: true });
});

// ── Allowed MIME types ────────────────────────────────────────────────────────
const ALLOWED_MIMES = {
  portrait: ['image/jpeg', 'image/png', 'image/webp'],
  passport: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  idcard:   ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
};

// ── File extensions from MIME types ──────────────────────────────────────────
const MIME_EXTENSIONS = {
  'image/jpeg':       '.jpg',
  'image/png':        '.png',
  'image/webp':       '.webp',
  'application/pdf':  '.pdf',
};

// ── Max file size ─────────────────────────────────────────────────────────────
const MAX_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10); // 5 MB

// ── Disk storage engine ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const docType = file.fieldname; // 'portrait' | 'passport' | 'idcard'
    const dir = DEST_MAP[docType] || UPLOAD_ROOT;
    cb(null, dir);
  },
  filename(req, file, cb) {
    const ext  = MIME_EXTENSIONS[file.mimetype] || path.extname(file.originalname).toLowerCase();
    const name = `${uuidv4()}${ext}`;
    cb(null, name);
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
const uploadDocuments = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).fields([
  { name: 'portrait', maxCount: 1 },
  { name: 'passport', maxCount: 1 },
  { name: 'idcard',   maxCount: 1 },
]);

/** Upload a single portrait only */
const uploadPortrait = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).single('portrait');

/** Upload a single document (passport OR idcard) */
const uploadSingleDoc = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE },
}).single('document');

// ── Utility: resolve public URL from stored path ──────────────────────────────
function fileUrl(filePath) {
  if (!filePath) return null;
  // Convert absolute disk path to a relative API path
  const relative = filePath.replace(UPLOAD_ROOT, '').replace(/\\/g, '/');
  return `/uploads${relative}`;
}

// ── Utility: delete a file from disk ─────────────────────────────────────────
function deleteFile(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('[deleteFile] Could not remove:', filePath, err.message);
  }
}

module.exports = {
  uploadDocuments,
  uploadPortrait,
  uploadSingleDoc,
  fileUrl,
  deleteFile,
  UPLOAD_ROOT,
};