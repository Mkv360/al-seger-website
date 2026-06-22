/**
 * middleware/auth.js
 * JWT-based authentication and role-based authorization middleware.
 */

'use strict';

const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// ── Token extraction ──────────────────────────────────────────────────────────

function extractToken(req) {
  const authHeader = req.headers['authorization'];

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  // Optional cookie fallback
  if (req.cookies && req.cookies.token) {
    return req.cookies.token;
  }

  return null;
}

// ── authenticate ─────────────────────────────────────────────────────────────

/**
 * Validates JWT and attaches req.admin.
 * Sends 401 if token is missing, invalid, or expired.
 */
async function authenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  try {
    // verify once
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // enforce token type separation
    if (payload.type && payload.type !== 'admin') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    const admin = await Admin.findById(payload.id);

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Account not found.',
      });
    }

    if (!admin.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account is deactivated.',
      });
    }

    req.admin = admin;
    next();

  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }
}

// ── authorize ─────────────────────────────────────────────────────────────────

/**
 * Role-based access control.
 * Usage: authorize('super_admin', 'admin')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.',
      });
    }

    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}.`,
      });
    }

    next();
  };
}

// ── generateToken ─────────────────────────────────────────────────────────────

function generateToken(admin) {
  return jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin', // important for separation
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
}

module.exports = { authenticate, authorize, generateToken };