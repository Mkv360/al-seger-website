/**
 * middleware/upload.js
 * Wraps Multer upload functions in promise-based error handling.
 *
 * CHANGES FROM ORIGINAL:
 *   - Imports uploadAdminAvatar from config/multer
 *   - Exports handleAvatarUpload
 *   - LIMIT_UNEXPECTED_FILE message updated to include 'avatar'
 */

'use strict';

const multer = require('multer');
const {
  uploadDocuments,
  uploadPortrait,
  uploadSingleDoc,
  uploadAdminAvatar,
} = require('../config/multer');

function wrapMulter(multerFn) {
  return (req, res, next) => {
    multerFn(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        let message = 'File upload error.';
        if (err.code === 'LIMIT_FILE_SIZE') {
          const mb = Math.round(parseInt(process.env.MAX_FILE_SIZE || '5242880', 10) / 1048576);
          message = `File too large. Maximum allowed size is ${mb} MB.`;
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          message = `Unexpected field: '${err.field}'. Allowed fields: portrait, passport, idcard, avatar.`;
        }
        return res.status(400).json({ success: false, message });
      }

      if (err.status === 400) {
        return res.status(400).json({ success: false, message: err.message });
      }

      next(err);
    });
  };
}

module.exports = {
  handleDocumentUploads: wrapMulter(uploadDocuments),
  handlePortraitUpload:  wrapMulter(uploadPortrait),
  handleSingleDocUpload: wrapMulter(uploadSingleDoc),
  handleAvatarUpload:    wrapMulter(uploadAdminAvatar), // ← NEW
};