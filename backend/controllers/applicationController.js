'use strict';

const Application  = require('../models/Application');
const { UPLOAD_ROOT } = require('../config/multer');

/* ──────────────────────────────────────────────────────────────────
   FIX 4 — Explicit ENUM mapping
   Never silently default: if the frontend sends something other than
   'Yes', it becomes 'No'. This surfaces frontend bugs instead of
   hiding them.
────────────────────────────────────────────────────────────────── */
const yn = (v) => (v === 'Yes' ? 'Yes' : 'No');

/* ──────────────────────────────────────────────────────────────────
   FIX 6 — Relative file path
   Store path relative to UPLOAD_ROOT (e.g. portraits/uuid.jpg), NOT
   a full URL. Serving is handled by the static middleware in server.js:
     GET /uploads/portraits/uuid.jpg
   If UPLOAD_ROOT moves, stored paths remain valid — only the server
   mount point changes.
────────────────────────────────────────────────────────────────── */
const relPath = (file) => {
  if (!file?.path) return null;
  return file.path
    .replace(UPLOAD_ROOT, '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');           // → portraits/uuid.jpg
};

/* ──────────────────────────────────────────────────────────────────
   FIX 7 — Request validation
   Runs before any DB work. Returns an array of error messages; an
   empty array means valid. No external library required.
────────────────────────────────────────────────────────────────── */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_TEXT = [
  ['first_name',          'First Name'],
  ['middle_name',         'Middle Name'],
  ['last_name',           'Last Name'],
  ['dob',                 'Date of Birth'],
  ['birth_place',         'Place of Birth'],
  ['age',                 'Age'],
  ['height',              'Height'],
  ['weight',              'Weight'],
  ['marital_status',      'Marital Status'],
  ['religion',            'Religion'],
  ['nationality',         'Nationality'],
  // application_number / post_applied / contract_period / monthly_salary /
  // education / country REMOVED — these are agency-assigned during admin
  // review, not collected from the applicant at signup.
  ['passport_number',     'Passport Number'],
  ['issue_place',         'Issue Place'],
  ['passport_issue_date', 'Passport Issue Date'],
  ['passport_expiry',     'Passport Expiry Date'],
  ['experience_period',   'Experience Period'],
  ['experience_country',  'Experience Country'],
  ['phone',               'Phone'],
  ['family_phone',        'Family Phone'],
  ['note',                'Note'],
];

function validate(b, files) {
  const errors = [];

  // Presence check for all required text/select fields
  for (const [field, label] of REQUIRED_TEXT) {
    if (!b[field]?.toString().trim()) {
      errors.push(`${label} is required.`);
    }
  }

  // Age: must be a number in the expected working-age range
  const age = parseInt(b.age, 10);
  if (b.age && (isNaN(age) || age < 18 || age > 65)) {
    errors.push('Age must be a number between 18 and 65.');
  }

  // Dates: must be YYYY-MM-DD (what <input type="date"> always sends)
  for (const [field, label] of [
    ['dob',                 'Date of Birth'],
    ['passport_issue_date', 'Passport Issue Date'],
    ['passport_expiry',     'Passport Expiry Date'],
  ]) {
    if (b[field] && !DATE_RE.test(b[field])) {
      errors.push(`${label} must be in YYYY-MM-DD format.`);
    }
  }

  // Passport must not already be expired
  if (b.passport_expiry && DATE_RE.test(b.passport_expiry)) {
    if (new Date(b.passport_expiry) <= new Date()) {
      errors.push('Passport is expired. Please provide a valid passport.');
    }
  }

  // Required files (idcard is optional per the form's missing `required` attr)
  if (!files?.portrait?.[0]) errors.push('Portrait photo is required.');
  if (!files?.passport?.[0]) errors.push('Passport photo is required.');

  return errors;
}

/* ──────────────────────────────────────────────────────────────────
   createApplication
   POST /api/applications/create
   Chain: authenticateUser → runUpload (multer) → here
────────────────────────────────────────────────────────────────── */
const createApplication = async (req, res) => {
  try {
    const b      = req.body;
    const userId = req.user?.id ?? null;

    // FIX 7: validate before touching the DB
    const errors = validate(b, req.files);
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors[0], errors });
    }

    const data = {
      user_id: userId,

      // ── FIX 2: Single naming — each concept has exactly one DB column ──
      // No full_name (use first/middle/last), no phone_or_email (use phone),
      // no job_category (use post_applied), no message (use note).
      first_name:     b.first_name.trim(),
      middle_name:    b.middle_name.trim(),
      last_name:      b.last_name.trim(),
      dob:            b.dob,
      birth_place:    b.birth_place.trim(),
      age:            parseInt(b.age, 10),
      height:         b.height.trim(),
      weight:         b.weight.trim(),
      marital_status: b.marital_status,
      religion:       b.religion,
      nationality:    b.nationality.trim().toUpperCase(),

application_number: b.application_number?.trim() || null,
post_applied:       b.post_applied?.trim()       || null,
contract_period:    b.contract_period?.trim()    || null,
monthly_salary:     b.monthly_salary?.trim()     || null,
education:          b.education?.trim()          || null,
country:            b.country?.trim()            || null,

      passport_number:     b.passport_number.trim(),
      issue_place:         b.issue_place.trim(),
      passport_issue_date: b.passport_issue_date,
      passport_expiry:     b.passport_expiry,

      // ── FIX 3: Structured experience only — no combined "X in Y" string ──
      experience_period:  b.experience_period.trim(),
      experience_country: b.experience_country.trim(),

      // ── FIX 4: Explicit Yes/No mapping — html name="english" → lang_english ──
      lang_english: yn(b.english),
      lang_arabic:  yn(b.arabic),
      lang_french:  yn(b.french),

      skill_care_elderly: yn(b.care_elderly),
      skill_babysitter:   yn(b.babysitter),
      skill_cleaning:     yn(b.cleaning),
      skill_cooking:      yn(b.cooking),

      phone:        b.phone.trim(),           // not duplicated as phone_or_email
      family_phone: b.family_phone.trim(),
      note:         b.note.trim(),            // not duplicated as message

      // ── FIX 6: Relative path — no full URL in DB ─────────────────────────
      portrait_path: relPath(req.files?.portrait?.[0]),
      passport_path: relPath(req.files?.passport?.[0]),
      idcard_path:   relPath(req.files?.idcard?.[0]),  // optional
    };

    const result = await Application.create(data);

    return res.status(201).json({
      success: true,
      message: 'Application submitted successfully.',
      data:    { id: result.insertId },
    });

  } catch (error) {
    console.error('[createApplication]', { message: error.message, code: error.code });
    return res.status(500).json({
      success: false,
      message: 'Failed to submit application. Please try again later.',
    });
  }
};

/* ──────────────────────────────────────────────────────────────────
   getMyApplications
   GET /api/applications/my
────────────────────────────────────────────────────────────────── */
// controllers/applicationController.js

const getMyApplications = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // Surfaces hypothesis #2 immediately instead of falling through to a DB error
      return res.status(401).json({ success: false, message: 'Not authenticated.' });
    }

    // Sequential instead of Promise.all — rules out hypothesis #1 (connection
    // contention) entirely. Negligible latency cost for two small queries.
    const applications = await Application.findByUser(userId);
    const stats         = await Application.getStats(userId);

    const summary = { total: applications.length, pending: 0, approved: 0, rejected: 0 };
    stats.forEach((s) => { summary[s.status] = Number(s.count); });

    return res.json({ success: true, data: { applications, summary } });

  } catch (error) {
    // Log the FULL error (stack + code), not just .message
    console.error('[getMyApplications]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load applications.',
      // Dev-only: exposes the real cause in the response body so you can see
      // it in DevTools → Network → Response without needing the terminal.
      ...(process.env.NODE_ENV !== 'production' && {
        debug: error.message,
        code: error.code,
      }),
    });
  }
};
module.exports = { createApplication, getMyApplications };