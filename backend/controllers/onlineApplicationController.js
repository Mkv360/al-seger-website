'use strict';

const path = require('path');
const fs   = require('fs');

const Application = require('../models/Application');
const Applicant   = require('../models/Applicant');
const { deleteFile, UPLOAD_ROOT } = require('../config/multer');
const ASSIGNMENT_FIELDS = [
  ['post_applied_for', 'Post Applied For'],
  ['contract_period', 'Contract Period'],
  ['monthly_salary', 'Monthly Salary'],
  ['education', 'Education'],
  ['destination_country', 'Destination Country'],
];
const toAbsolute = (rel) => (rel ? path.join(UPLOAD_ROOT, rel) : null);

function generateApplicationNumber(id) {
  const year = new Date().getFullYear();
  return `AST-${year}-${String(id).padStart(6, '0')}`;
}

function mimeFromExt(filePath) {
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.pdf': 'application/pdf' };
  return map[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

async function getAll(req, res, next) {
  try {
    const rows = await Application.findAll();
    return res.status(200).json({ success: true, data: rows });
  } catch (err) { next(err); }
}

async function getOne(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
    const row = await Application.findById(id);
    if (!row) return res.status(404).json({ success: false, message: 'Application not found.' });
    return res.status(200).json({ success: true, data: row });
  } catch (err) { next(err); }
}

// PATCH /:id/assign — office fills in job-matching fields before approval
async function assignDetails(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

    const existing = await Application.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Application not found.' });

    const b = req.body || {};
    const updates = {};
    for (const [field] of ASSIGNMENT_FIELDS) {
      if (b[field]?.toString().trim()) updates[field] = b[field].toString().trim();
    }
    if (!existing.application_number) {
      updates.application_number = generateApplicationNumber(id);
    }

    const updated = await Application.updateAssignment(id, updates);
    return res.status(200).json({ success: true, message: 'Details assigned.', data: updated });
  } catch (err) { next(err); }
}

// PATCH /:id/approve — validates assignment is complete, then promotes to Applicant
async function approveApplication(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });

    const application = await Application.findById(id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found.' });
    if (application.status === 'approved') {
      return res.status(409).json({ success: false, message: 'Already approved.' });
    }

    const b = req.body || {};
    const merged = { ...application };
    for (const [field] of ASSIGNMENT_FIELDS) {
      if (b[field] !== undefined && b[field] !== null && b[field] !== '') {
  merged[field] = b[field].toString().trim();
}
    }
    if (!merged.application_number) merged.application_number = generateApplicationNumber(id);

    const missing = ASSIGNMENT_FIELDS.filter(([f]) => !merged[f]).map(([, label]) => label);
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Cannot approve — missing: ${missing.join(', ')}.`,
      });
    }

    await Application.updateAssignment(id, {
      application_number: merged.application_number,
      post_applied:        merged.post_applied,
      contract_period:     merged.contract_period,
      monthly_salary:      merged.monthly_salary,
      education:           merged.education,
      country:             merged.country,
    });

    // ⚠ ASSUMPTION — confirm column names against models/Applicant.js.
    // `gender` isn't collected anywhere yet; decide whether to add it to
    // the public form or leave nullable on Applicant.
    console.log("APPLICANT DATA:", {
  destination_country: merged.destination_country,
  post_applied_for: merged.post_applied_for,
});
const applicant = await Applicant.create({
  first_name: merged.first_name || null,
  middle_name: merged.middle_name || null,
  last_name: merged.last_name || null,
  dob: merged.dob || null,
  birth_place: merged.birth_place || null,
  age: merged.age || null,
  height: merged.height || null,
  weight: merged.weight || null,
  marital_status: merged.marital_status || null,
  religion: merged.religion || null,
  nationality: merged.nationality || null,

  // IMPORTANT FIX HERE
  destination_country_id: merged.destination_country || null,

  post_applied: merged.post_applied_for || null,
  contract_period: merged.contract_period || null,
  monthly_salary: merged.monthly_salary || null,
  education: merged.education || null,

  passport_number: merged.passport_number || null,
  issue_place: merged.issue_place || null,
  passport_issue_date: merged.passport_issue_date || null,
  passport_expiry: merged.passport_expiry || null,

  experience_period: merged.experience_period || null,
  experience_country: merged.experience_country || null,

  phone: merged.phone || null,
  family_phone: merged.family_phone || null,
  note: merged.note || null,

  reference_number: merged.application_number || null,
  user_id: merged.user_id || null,
  status: 'pending',
});
    const docs = [
      ['portrait', merged.portrait_path],
      ['passport', merged.passport_path],
      ['idcard',   merged.idcard_path],
    ];
    for (const [docType, rel] of docs) {
      if (!rel) continue;
      const abs = toAbsolute(rel);
      if (!fs.existsSync(abs)) continue;
      const stat = fs.statSync(abs);
      await Applicant.upsertDocument({
        applicant_id:  applicant.id,
        document_type: docType,
        file_path:     abs,
        file_name:     path.basename(abs),
        file_size:     stat.size,
        mime_type:     mimeFromExt(abs),
      });
    }

    await Application.updateStatus(id, 'approved');
    await Application.linkApplicant(id, applicant.id);

    return res.status(200).json({
      success: true,
      message: `Approved and moved to Applicants (${applicant.reference_number || applicant.id}).`,
      data: { application_id: id, applicant_id: applicant.id },
    });
  } catch (err) { next(err); }
}

async function rejectApplication(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
    const existing = await Application.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Application not found.' });
    await Application.updateStatus(id, 'rejected');
    return res.status(200).json({ success: true, message: 'Application rejected.' });
  } catch (err) { next(err); }
}

async function deleteApplication(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ success: false, message: 'Invalid id.' });
    const existing = await Application.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: 'Application not found.' });

    [existing.portrait_path, existing.passport_path, existing.idcard_path]
      .filter(Boolean)
      .forEach((p) => deleteFile(toAbsolute(p)));

    await Application.delete(id);
    return res.status(200).json({ success: true, message: 'Application deleted.' });
  } catch (err) { next(err); }
}

module.exports = { getAll, getOne, assignDetails, approveApplication, rejectApplication, deleteApplication };