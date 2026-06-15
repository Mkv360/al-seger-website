/**
 * controllers/settingsController.js
 * Read and update system settings.
 */

'use strict';

const Setting = require('../models/Setting');
const { query } = require('../config/db');

// ── GET /api/settings ─────────────────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const { group } = req.query;
    const settings = await Setting.findAll({ group });
    return res.status(200).json({ success: true, data: settings });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/settings/:key ────────────────────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const setting = await Setting.findByKey(req.params.key);
    if (!setting) {
      return res.status(404).json({ success: false, message: `Setting '${req.params.key}' not found.` });
    }
    return res.status(200).json({ success: true, data: setting });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/settings/:key ────────────────────────────────────────────────────
async function updateOne(req, res, next) {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ success: false, message: 'value is required.' });
    }

    const setting = await Setting.upsert(req.params.key, value);

    await query(
      `INSERT INTO activity_log (admin_id, action, entity_type, details, ip_address)
       VALUES (?, 'UPDATE_SETTING', 'setting', ?, ?)`,
      [req.admin.id, JSON.stringify({ key: req.params.key, value }), req.ip]
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `Setting '${req.params.key}' updated.`,
      data: setting,
    });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/settings (bulk) ──────────────────────────────────────────────────
async function bulkUpdate(req, res, next) {
  try {
    const { settings } = req.body;
    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({ success: false, message: 'settings array is required.' });
    }

    const results = await Setting.bulkUpdate(settings);

    await query(
      `INSERT INTO activity_log (admin_id, action, entity_type, details, ip_address)
       VALUES (?, 'BULK_UPDATE_SETTINGS', 'setting', ?, ?)`,
      [req.admin.id, JSON.stringify({ count: settings.length }), req.ip]
    ).catch(() => {});

    return res.status(200).json({
      success: true,
      message: `${results.length} setting(s) updated.`,
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getOne, updateOne, bulkUpdate };