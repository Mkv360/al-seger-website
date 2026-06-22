/**
 * controllers/authController.js
 * Handles authentication: login, logout, session info, password change.
 *
 * ─────────────────────────────────────────────────────────────────
 * BUGS FIXED IN THIS FILE
 * ─────────────────────────────────────────────────────────────────
 * BUG 1 (CRITICAL – root cause of "fails silently / 500"):
 *   Every `query(INSERT INTO activity_log …)` call was AWAITED inside
 *   the main try-block WITHOUT its own error handler.
 *   If the activity_log table doesn't exist (or has column mismatches),
 *   the query throws, the catch block calls next(err), and Express
 *   returns a 500 – BEFORE the 200/401 response ever leaves.
 *
 *   Concrete failure paths that were broken:
 *     • Correct password → updateLastLogin OK → activity_log INSERT
 *       throws → next(err) → 500 instead of 200 ✗
 *     • Wrong password   → activity_log INSERT throws → next(err)
 *       → 500 instead of 401 ✗
 *     • Logout           → activity_log INSERT throws → 500 instead of 200 ✗
 *     • changePassword   → activity_log INSERT throws → 500 instead of 200 ✗
 *
 *   FIX: Each activity_log insert and the updateLastLogin call are now
 *   wrapped in their own try/catch.  Logging failure is non-fatal —
 *   it is recorded on the console so you can still debug, but it
 *   never blocks the HTTP response.
 *
 * BUG 2 (minor – code smell):
 *   `email.toLowerCase().trim()` was done in the controller AND again
 *   inside Admin.findByEmail().  Double normalisation is harmless but
 *   inconsistent.  Removed from the controller; Admin.findByEmail()
 *   is the single source of truth for normalisation.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const { validationResult } = require('express-validator');
const Admin                = require('../models/Admin');
const { generateToken }    = require('../middleware/adminAuth');
const { query }            = require('../config/db');

// ── POST /api/auth/login ──────────────────────────────────────────────────────

async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;

    // FIX: removed redundant email.toLowerCase().trim() here;
    //      Admin.findByEmail() already normalises the email.
    const admin = await Admin.findByEmail(email);
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (!admin.is_active) {
      return res.status(403).json({ success: false, message: 'Account is deactivated.' });
    }

    const valid = await Admin.verifyPassword(password, admin.password);

    if (!valid) {
      // FIX (BUG 1): isolated try/catch — a missing activity_log table
      //              must NOT prevent the 401 from reaching the client.
      try {
        await query(
          `INSERT INTO activity_log
             (admin_id, action, entity_type, entity_id, details, ip_address)
           VALUES (?, 'LOGIN_FAILED', 'admin', ?, ?, ?)`,
          [admin.id, admin.id, JSON.stringify({ email }), req.ip]
        );
      } catch (logErr) {
        console.error('[Auth] Could not write LOGIN_FAILED to activity_log:', logErr.message);
      }

      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    // FIX (BUG 1): isolated try/catch — updateLastLogin failure must
    //              NOT prevent the 200 from reaching the client.
    try {
      await Admin.updateLastLogin(admin.id);
    } catch (updateErr) {
      console.error('[Auth] Could not update last_login:', updateErr.message);
    }

    // FIX (BUG 1): isolated try/catch — activity_log failure must
    //              NOT prevent the 200 from reaching the client.
    try {
      await query(
        `INSERT INTO activity_log
           (admin_id, action, entity_type, entity_id, details, ip_address)
         VALUES (?, 'LOGIN', 'admin', ?, ?, ?)`,
        [admin.id, admin.id, JSON.stringify({ method: 'password' }), req.ip]
      );
    } catch (logErr) {
      console.error('[Auth] Could not write LOGIN to activity_log:', logErr.message);
    }

    const token = generateToken(admin);

    // Strip the password hash from the response payload
    const { password: _pw, ...adminData } = admin;

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${admin.name}`,
      data: {
        token,
        admin: adminData,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

async function logout(req, res, next) {
  try {
    // FIX (BUG 1): isolated try/catch — logging must not block logout.
    try {
      await query(
        `INSERT INTO activity_log
           (admin_id, action, entity_type, entity_id, ip_address)
         VALUES (?, 'LOGOUT', 'admin', ?, ?)`,
        [req.admin.id, req.admin.id, req.ip]
      );
    } catch (logErr) {
      console.error('[Auth] Could not write LOGOUT to activity_log:', logErr.message);
    }

    // JWT is stateless; the client discards the token.
    return res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

async function me(req, res) {
  // req.admin is set by the authenticate middleware
  return res.status(200).json({
    success: true,
    data: req.admin,
  });
}

// ── PUT /api/auth/password ────────────────────────────────────────────────────

async function changePassword(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { current_password, new_password } = req.body;

    // Re-fetch to get the live password hash
    const admin = await Admin.findByEmail(req.admin.email);
    const valid = await Admin.verifyPassword(current_password, admin.password);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    await Admin.updatePassword(req.admin.id, new_password);

    // FIX (BUG 1): isolated try/catch — logging must not block the 200.
    try {
      await query(
        `INSERT INTO activity_log
           (admin_id, action, entity_type, entity_id, ip_address)
         VALUES (?, 'CHANGE_PASSWORD', 'admin', ?, ?)`,
        [req.admin.id, req.admin.id, req.ip]
      );
    } catch (logErr) {
      console.error('[Auth] Could not write CHANGE_PASSWORD to activity_log:', logErr.message);
    }

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/auth/profile ─────────────────────────────────────────────────────

async function updateProfile(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { name, email } = req.body;
    const updated = await Admin.update(req.admin.id, { name, email });

    return res.status(200).json({
      success: true,
      message: 'Profile updated.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, logout, me, changePassword, updateProfile };