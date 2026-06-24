'use strict';

const path = require('path');
const fs   = require('fs');

const Application = require('../models/Application');
const Applicant   = require('../models/Applicant');
const { deleteFile, UPLOAD_ROOT } = require('../config/multer');
const { queryOne } = require('../config/db'); // ← added: needed for country lookup

const ASSIGNMENT_FIELDS = [
  ['post_applied_for', 'Post Applied For'],
  ['contract_period',  'Contract Period'],
  ['monthly_salary',   'Monthly Salary'],
  ['education',        'Education'],
  ['destination_country', 'Destination Country'],
];

const toAbsolute = (rel) => (rel ? path.join(UPLOAD_ROOT, rel) : null);

function generateApplicationNumber(id) {
  const year = new Date().getFullYear();
  return `AST-${year}-${String(id).padStart(6, '0')}`;
}

function mimeFromExt(filePath) {
  const map = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.webp': 'image/webp',
    '.pdf':  'application/pdf',
  };
  return map[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolve a country name (e.g. 'Qatar') → integer PK in countries table.
 * Returns null if name is empty or no matching row is found.
 * Never returns undefined.
 */
async function resolveCountryId(name) {
  if (!name || typeof name !== 'string') return null;
  const row = await queryOne(
    'SELECT id FROM countries WHERE name = ? LIMIT 1',
    [name.trim()]
  );
  return row ? row.id : null;
}

/**
 * Scan a flat payload object and throw a descriptive error listing
 * every key whose value is still `undefined`.
 * Call this immediately before Applicant.create() as a last-resort guard.
 */
function assertNoUndefined(label, payload) {
  const bad = Object.entries(payload)
    .filter(([, v]) => v === undefined)
    .map(([k]) => k);
  if (bad.length) {
    throw new Error(
      `[${label}] undefined value for: ${bad.join(', ')}. Pass null explicitly.`
    );
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

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

async function approveApplication(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, message: 'Invalid id.' });
    }

    // 1. Load
    const application = await Application.findById(id);
    if (!application) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    if (application.status === 'approved') {
      return res.status(409).json({ success: false, message: 'Already approved.' });
    }

    // 2. Merge admin input
// ── Merge admin data safely ─────────────────────────────
const b = req.body || {};
const merged = {
  first_name: application.first_name,
  last_name: application.last_name,
  email: application.email,
  phone: application.phone,
  dob: application.dob,
  nationality: application.nationality,
  national_id: application.national_id,
  passport_number: application.passport_number,
  passport_expiry: application.passport_expiry,
  education: application.education,
  experience_years: application.experience_years,
  languages: application.languages,
  skills: application.skills,
  address: application.address,
  emergency_contact_name: application.emergency_contact_name,
  emergency_contact_phone: application.emergency_contact_phone,
  portrait_path: application.portrait_path,
  passport_path: application.passport_path,
  idcard_path: application.idcard_path,
};

// accept both naming styles to prevent frontend mismatch bugs
for (const [field] of ASSIGNMENT_FIELDS) {
  const value = b[field];

  if (value !== undefined && value !== null && value !== '') {
    merged[field] = String(value).trim();
  }
}
// generate application number if missing
if (!merged.application_number) {
  merged.application_number = generateApplicationNumber(id);
}

// ── Validate assignment fields properly ─────────────────
const missing = ASSIGNMENT_FIELDS
  .filter(([f]) => {
    const v = merged[f];
    return v === undefined || v === null || String(v).trim() === '';
  })
  .map(([, label]) => label);

    // 4. Save back to applications table (ONLY assignment fields)
    await Application.updateAssignment(id, {
      application_number: merged.application_number,
      post_applied_for: merged.post_applied_for,
      contract_period: merged.contract_period,
      monthly_salary: merged.monthly_salary,
      education: merged.education,
      destination_country: merged.destination_country,
    });

    // 5. Resolve country
    const destinationCountryId = await resolveCountryId(merged.destination_country);

    // 6. Create applicant (CLEAN MAPPING ONLY)
const applicantPayload = {
  first_name: merged.first_name ?? null,
  last_name: merged.last_name ?? null,
  email: merged.email ?? null,
  phone: merged.phone ?? null,

  date_of_birth: merged.dob || application.date_of_birth || null,
  gender: null,

  nationality: merged.nationality ?? null,
  national_id: merged.national_id ?? null,

  passport_number: merged.passport_number ?? null,
  passport_expiry: merged.passport_expiry ?? null,

  destination_country_id: destinationCountryId ?? null,
  origin_country_id: null,

  education: merged.education ?? null,
  experience_years: merged.experience_years ?? null,

  languages: merged.languages ?? null,
  skills: merged.skills ?? null,

  address: merged.address ?? null,
  emergency_contact_name: merged.emergency_contact_name ?? null,
  emergency_contact_phone: merged.emergency_contact_phone ?? null,

  status: 'pending',
  admin_notes: null,
};
Object.entries(applicantPayload).forEach(([k, v]) => {
  if (v === undefined) {
    throw new Error(`Undefined detected in applicantPayload.${k}`);
  }
});
    assertNoUndefined('Applicant.create', applicantPayload);

    const applicant = await Applicant.create(applicantPayload);

    // 7. Copy documents
    const docs = [
      ['portrait', merged.portrait_path],
      ['passport', merged.passport_path],
      ['idcard', merged.idcard_path],
    ];

    for (const [type, rel] of docs) {
      if (!rel) continue;

      const abs = toAbsolute(rel);
      if (!fs.existsSync(abs)) continue;

      const stat = fs.statSync(abs);

      await Applicant.upsertDocument({
        applicant_id: applicant.id,
        document_type: type,
        file_path: abs,
        file_name: path.basename(abs),
        file_size: stat.size,
        mime_type: mimeFromExt(abs),
      });
    }

    // 8. Finalize
    await Application.updateStatus(id, 'approved');
    await Application.linkApplicant(id, applicant.id);

    return res.status(200).json({
      success: true,
      message: 'Approved successfully.',
      data: {
        application_id: id,
        applicant_id: applicant.id,
      },
    });

  } catch (err) {
    next(err);
  }
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

module.exports = {
  getAll,
  getOne,
  assignDetails,
  approveApplication,
  rejectApplication,
  deleteApplication,
};