/**
 * controllers/profileController.js
 * Handles GET and PUT /api/profile for the authenticated admin.
 *
 * Storage strategy (consistent with applicant_documents):
 *   DB stores the absolute disk path (req.file.path from multer).
 *   fileUrl() converts it to a relative URL (/uploads/admin/xxx.jpg).
 *   Frontend prepends SERVER_ROOT to build the full URL.
 *
 * Depends on:
 *   req.admin  — set by authenticate middleware (contains live DB row)
 *   req.file   — set by handleAvatarUpload (multer field: 'avatar'), or undefined
 */

'use strict';

const Admin                   = require('../models/Admin');
const { fileUrl, deleteFile } = require('../config/multer');

// ── GET /api/profile ──────────────────────────────────────────────────────────
async function getProfile(req, res, next) {
  try {
    const admin = await Admin.findById(req.admin.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found.' });
    }

    const { password, ...adminData } = admin;
    adminData.avatar_url = fileUrl(adminData.avatar); // null when no avatar set

    return res.json({ success: true, admin: adminData });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/profile ──────────────────────────────────────────────────────────
async function updateProfile(req, res, next) {
  try {
    const { name } = req.body;
    const updates  = {};

    // ── name ──────────────────────────────────────────────────────────────────
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 2 || trimmed.length > 120) {
        // If multer already saved a file, clean it up before rejecting
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({
          success: false,
          message: 'Name must be between 2 and 120 characters.',
        });
      }
      updates.name = trimmed;
    }

    // ── avatar ────────────────────────────────────────────────────────────────
    if (req.file) {
      // Remove the old avatar from disk (non-fatal — log but don't block response)
      if (req.admin.avatar) {
        try {
          deleteFile(req.admin.avatar);
        } catch (e) {
          console.error('[Profile] Could not delete old avatar:', e.message);
        }
      }
      updates.avatar = req.file.path; // absolute disk path
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: 'Nothing to update. Provide a name and/or an avatar image.',
      });
    }

    const updated = await Admin.update(req.admin.id, updates);
    const { password, ...adminData } = updated;
    adminData.avatar_url = fileUrl(adminData.avatar);

    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      admin:   adminData,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile };