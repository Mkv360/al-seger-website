/**
 * controllers/applicantController.js
 * Full CRUD for applicants, status transitions, and document uploads.
 */

'use strict';

const { validationResult }   = require('express-validator');
const Applicant              = require('../models/Applicant');
const { fileUrl, deleteFile } = require('../config/multer');
const { query }              = require('../config/db');
const path                   = require('path');

// ── Shared audit-log helper ───────────────────────────────────────────────────
async function log(adminId, action, entityId, details, ip) {
  await query(
    `INSERT INTO activity_log (admin_id, action, entity_type, entity_id, details, ip_address)
     VALUES (?, ?, 'applicant', ?, ?, ?)`,
    [adminId, action, entityId, JSON.stringify(details), ip]
  ).catch(() => {}); // Non-fatal
}

// ── GET /api/applicants ───────────────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const { search, status, gender, country, page = 1, limit = 25, sort, order } = req.query;

    const result = await Applicant.findAll({
      search:  search  || '',
      status:  status  || '',
      gender:  gender  || '',
      country: country || '',
      page:    parseInt(page, 10),
      limit:   Math.min(parseInt(limit, 10) || 25, 100),
      sort,
      order,
    });

    // Attach public URLs to documents in each applicant if needed
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/applicants/:id ───────────────────────────────────────────────────
async function getOne(req, res, next) {
  try {
    const applicant = await Applicant.findById(parseInt(req.params.id, 10));
    if (!applicant) {
      return res.status(404).json({ success: false, message: 'Applicant not found.' });
    }
    // Attach file URLs
    applicant.documents = (applicant.documents || []).map((d) => ({
      ...d,
      url: fileUrl(d.file_path),
    }));
    return res.status(200).json({ success: true, data: applicant });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/applicants ──────────────────────────────────────────────────────
async function create(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const applicant = await Applicant.create(req.body);

    // Handle document uploads if present
    if (req.files) {
      await _processUploadedFiles(req.files, applicant.id);
    }

    await log(req.admin?.id, 'CREATE_APPLICANT', applicant.id,
      { ref: applicant.reference_number }, req.ip);

    const full = await Applicant.findById(applicant.id);
    return res.status(201).json({
      success: true,
      message: `Applicant ${applicant.reference_number} created successfully.`,
      data: full,
    });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/applicants/:id ───────────────────────────────────────────────────
async function update(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const id = parseInt(req.params.id, 10);
    const existing = await Applicant.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Applicant not found.' });
    }

    const updated = await Applicant.update(id, req.body);

    await log(req.admin?.id, 'UPDATE_APPLICANT', id,
      { ref: updated.reference_number, fields: Object.keys(req.body) }, req.ip);

    return res.status(200).json({
      success: true,
      message: 'Applicant updated successfully.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/applicants/:id/status ─────────────────────────────────────────
async function updateStatus(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const id  = parseInt(req.params.id, 10);
    const { status, admin_notes, rejected_reason } = req.body;

    const existing = await Applicant.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Applicant not found.' });
    }

    const updated = await Applicant.updateStatus(id, status, {
      admin_notes:     admin_notes     || undefined,
      rejected_reason: rejected_reason || undefined,
    });

    await log(req.admin?.id, 'UPDATE_STATUS', id,
      { ref: existing.reference_number, from: existing.status, to: status }, req.ip);

    return res.status(200).json({
      success: true,
      message: `Applicant status updated to "${status}".`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/applicants/:id ────────────────────────────────────────────────
async function remove(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await Applicant.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Applicant not found.' });
    }

    // Remove physical document files
    if (existing.documents) {
      existing.documents.forEach((d) => deleteFile(d.file_path));
    }

    await Applicant.remove(id);
    await log(req.admin?.id, 'DELETE_APPLICANT', id,
      { ref: existing.reference_number }, req.ip);

    return res.status(200).json({
      success: true,
      message: `Applicant ${existing.reference_number} deleted.`,
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/applicants/:id/documents ───────────────────────────────────────
async function uploadDocuments(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    const existing = await Applicant.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Applicant not found.' });
    }

    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }

    const saved = await _processUploadedFiles(req.files, id);

    await log(req.admin?.id, 'UPLOAD_DOCUMENTS', id,
      { types: Object.keys(req.files) }, req.ip);

    return res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully.',
      data: saved,
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/applicants/:id/documents/:type ────────────────────────────────
async function deleteDocument(req, res, next) {
  try {
    const id   = parseInt(req.params.id, 10);
    const type = req.params.type;

    const validTypes = ['portrait', 'passport', 'idcard'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ success: false, message: `Invalid type. Use: ${validTypes.join(', ')}` });
    }

    const doc = await Applicant.deleteDocument(id, type);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found.' });
    }

    deleteFile(doc.file_path);

    return res.status(200).json({ success: true, message: `${type} document deleted.` });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/applicants/stats ─────────────────────────────────────────────────
async function getStats(req, res, next) {
  try {
    const [statusCounts, countryBreakdown] = await Promise.all([
      Applicant.getStatusCounts(),
      Applicant.getCountryBreakdown(),
    ]);
    return res.status(200).json({ success: true, data: { statusCounts, countryBreakdown } });
  } catch (err) {
    next(err);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function _processUploadedFiles(files, applicantId) {
  const results = [];
  const docTypes = ['portrait', 'passport', 'idcard'];

  for (const docType of docTypes) {
    const fileArr = files[docType];
    if (!fileArr || fileArr.length === 0) continue;
    const file = fileArr[0];

    const doc = await Applicant.upsertDocument({
      applicant_id:  applicantId,
      document_type: docType,
      file_path:     file.path,
      file_name:     file.originalname,
      file_size:     file.size,
      mime_type:     file.mimetype,
    });
    results.push({ ...doc, url: fileUrl(doc.file_path) });
  }
  return results;
}

module.exports = {
  getAll,
  getOne,
  create,
  update,
  updateStatus,
  remove,
  uploadDocuments,
  deleteDocument,
  getStats,
};