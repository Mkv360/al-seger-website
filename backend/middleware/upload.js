/**
 * middleware/upload.js
 * Wraps Multer upload functions in promise-based error handling
 * so upload errors flow cleanly through Express error middleware.
 */

'use strict';

const multer = require('multer');
const { uploadDocuments, uploadPortrait, uploadSingleDoc } = require('../config/multer');

function wrapMulter(multerFn) {
  return (req, res, next) => {
    multerFn(req, res, (err) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        let message = 'File upload error.';
        if (err.code === 'LIMIT_FILE_SIZE')      message = `File too large. Maximum allowed size is ${Math.round(parseInt(process.env.MAX_FILE_SIZE || 5242880) / 1048576)} MB.`;
        if (err.code === 'LIMIT_UNEXPECTED_FILE') message = `Unexpected field: '${err.field}'. Allowed fields: portrait, passport, idcard.`;
        return res.status(400).json({ success: false, message });
      }

      // Custom errors from fileFilter
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
};