/**
 * controllers/countryController.js
 * CRUD and statistics for countries.
 */

'use strict';

const { validationResult } = require('express-validator');
const Country = require('../models/Country');
const { query } = require('../config/db');

async function log(adminId, action, entityId, details, ip) {
  await query(
    `INSERT INTO activity_log (admin_id, action, entity_type, entity_id, details, ip_address)
     VALUES (?, ?, 'country', ?, ?, ?)`,
    [adminId, action, entityId, JSON.stringify(details), ip]
  ).catch(() => {});
}

// ── GET /api/countries ────────────────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const withStats  = req.query.stats  === 'true';
    const activeOnly = req.query.active === 'true';
    const data = withStats
      ? await Country.findWithStats()
      : await Country.findAll({ activeOnly });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/countries/:id ────────────────────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const country = await Country.findById(parseInt(req.params.id, 10));
    if (!country) {
      return res.status(404).json({ success: false, message: 'Country not found.' });
    }
    return res.status(200).json({ success: true, data: country });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/countries ───────────────────────────────────────────────────────
async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const existing = await Country.findByCode(req.body.code);
    if (existing) {
      return res.status(409).json({ success: false, message: `Country code '${req.body.code}' already exists.` });
    }

    const country = await Country.create(req.body);
    await log(req.admin.id, 'CREATE_COUNTRY', country.id, { name: country.name }, req.ip);

    return res.status(201).json({
      success: true,
      message: `Country '${country.name}' created.`,
      data: country,
    });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/countries/:id ────────────────────────────────────────────────────
async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const id = parseInt(req.params.id, 10);
    const existing = await Country.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Country not found.' });
    }

    const updated = await Country.update(id, req.body);
    await log(req.admin.id, 'UPDATE_COUNTRY', id, { name: updated.name }, req.ip);

    return res.status(200).json({
      success: true,
      message: 'Country updated.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/countries/:id ─────────────────────────────────────────────────
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await Country.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Country not found.' });
    }

    await Country.remove(id); // Throws 409 if in use
    await log(req.admin.id, 'DELETE_COUNTRY', id, { name: existing.name }, req.ip);

    return res.status(200).json({ success: true, message: `Country '${existing.name}' deleted.` });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAll, getOne, create, update, remove };