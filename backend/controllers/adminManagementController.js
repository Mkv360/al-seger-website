/**
 * controllers/adminManagementController.js
 * Super-admin-only CRUD for admin accounts.
 *
 * Self-protection guards (backend — not just UI):
 *   • Cannot deactivate your own account
 *   • Cannot change your own role
 *   • Cannot delete your own account
 */

'use strict';

const bcrypt     = require('bcryptjs');
const { query }  = require('../config/db');
const Admin      = require('../models/Admin');
const { fileUrl } = require('../config/multer');

// Strip password, attach avatar_url
function sanitise(admin) {
  const { password: _pw, ...data } = admin;
  data.avatar_url = fileUrl(data.avatar) ?? null;
  return data;
}

// ── GET /api/admin-management ─────────────────────────────────────────────────
async function listAdmins(req, res, next) {
  try {
    const rows = await query(
      `SELECT id, name, email, role, avatar, is_active, last_login, created_at
       FROM admins
       ORDER BY FIELD(role, 'super_admin', 'admin', 'viewer'), name ASC`
    );
    return res.json({ success: true, data: rows.map(sanitise) });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/admin-management ────────────────────────────────────────────────
async function createAdmin(req, res, next) {
  try {
    const { name, email, password, role = 'admin' } = req.body;

    if (!name?.trim() || name.trim().length < 2) {
      return res.status(400).json({ success: false, message: 'Name must be at least 2 characters.' });
    }
    if (!email?.trim()) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }
    if (!['super_admin', 'admin', 'viewer'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role.' });
    }

    const existing = await Admin.findByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An admin with this email already exists.' });
    }

    const hash   = await bcrypt.hash(password, 12);
    const result = await query(
      'INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hash, role]
    );

    const newAdmin = await Admin.findById(result.insertId);
    return res.status(201).json({
      success: true,
      message: `Admin "${newAdmin.name}" created successfully.`,
      data:    sanitise(newAdmin),
    });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/admin-management/:id ─────────────────────────────────────────────
async function updateAdmin(req, res, next) {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid admin ID.' });
    }

    const { name, email, password, role, is_active } = req.body;

    // Self-protection
    if (targetId === req.admin.id) {
      if (is_active !== undefined && !Number(is_active)) {
        return res.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
      }
      if (role && role !== req.admin.role) {
        return res.status(400).json({ success: false, message: 'You cannot change your own role.' });
      }
    }

    const target = await Admin.findById(targetId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    const fields = [];
    const values = [];

    if (name?.trim()) {
      fields.push('name = ?');
      values.push(name.trim());
    }
    if (email?.trim()) {
      const normalised = email.toLowerCase().trim();
      const clash = await query(
        'SELECT id FROM admins WHERE email = ? AND id != ? LIMIT 1',
        [normalised, targetId]
      );
      if (clash.length) {
        return res.status(409).json({ success: false, message: 'Email already used by another admin.' });
      }
      fields.push('email = ?');
      values.push(normalised);
    }
    if (role && ['super_admin', 'admin', 'viewer'].includes(role)) {
      fields.push('role = ?');
      values.push(role);
    }
    if (is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(Number(is_active) ? 1 : 0);
    }
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });
      }
      fields.push('password = ?');
      values.push(await bcrypt.hash(password, 12));
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'Nothing to update.' });
    }

    values.push(targetId);
    await query(`UPDATE admins SET ${fields.join(', ')} WHERE id = ?`, values);

    const updated = await Admin.findById(targetId);
    return res.json({
      success: true,
      message: 'Admin updated successfully.',
      data:    sanitise(updated),
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/admin-management/:id ──────────────────────────────────────────
async function deleteAdmin(req, res, next) {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (Number.isNaN(targetId)) {
      return res.status(400).json({ success: false, message: 'Invalid admin ID.' });
    }
    if (targetId === req.admin.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
    }

    const target = await Admin.findById(targetId);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    await query('DELETE FROM admins WHERE id = ?', [targetId]);

    return res.json({
      success: true,
      message: `Admin "${target.name}" has been deleted.`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAdmins, createAdmin, updateAdmin, deleteAdmin };