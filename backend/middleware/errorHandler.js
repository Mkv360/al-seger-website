/**
 * middleware/errorHandler.js
 * Centralised Express error-handling middleware.
 * Must be registered LAST (after all routes).
 */

'use strict';

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log full error in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    console.error('[ERROR]', err);
  } else {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} — ${err.message}`);
  }

  // Determine HTTP status
  const status = err.status || err.statusCode || 500;

  // MySQL duplicate-entry error
  if (err.code === 'ER_DUP_ENTRY') {
    const field = err.sqlMessage?.match(/key '(.+?)'/)?.[1] || 'field';
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
    });
  }

  // MySQL foreign-key constraint error
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
    });
  }

  // express-validator errors surface as arrays
  if (Array.isArray(err)) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors:  err.map((e) => ({ field: e.path || e.param, message: e.msg })),
    });
  }

  // Generic response
  res.status(status).json({
    success: false,
    message: status < 500 ? err.message : 'An unexpected error occurred. Please try again.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// ── 404 handler (register before errorHandler) ────────────────────────────────
function notFound(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = { errorHandler, notFound };