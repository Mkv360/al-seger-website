/**
 * models/Applicant.js
 * Data-access layer for applicants and applicant_documents tables.
 */

'use strict';

const { query, queryOne, withTransaction } = require('../config/db');

// ── Reference number generator ────────────────────────────────────────────────

async function generateReferenceNumber() {
  const year   = new Date().getFullYear();
  const prefix = `ALG-${year}-`;
  const row    = await queryOne(
    `SELECT reference_number FROM applicants
     WHERE reference_number LIKE ?
     ORDER BY id DESC LIMIT 1`,
    [`${prefix}%`]
  );
  if (!row) return `${prefix}0001`;
  const lastSeq = parseInt(row.reference_number.split('-')[2], 10);
  const nextSeq = String(lastSeq + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

// ── Base SELECT (safe columns, no password-like fields) ───────────────────────

const BASE_SELECT = `
  a.id, a.reference_number,
  a.first_name, a.last_name,
  CONCAT(a.first_name,' ',a.last_name) AS full_name,
  a.email, a.phone, a.date_of_birth, a.gender,
  a.nationality, a.national_id, a.passport_number, a.passport_expiry,
  a.destination_country_id, a.origin_country_id,
  a.education, a.experience_years, a.languages, a.skills,
  a.address, a.emergency_contact_name, a.emergency_contact_phone,
  a.status, a.admin_notes, a.rejected_reason,
  a.applied_at, a.processed_at, a.created_at, a.updated_at,
  dc.name        AS destination_country,
  dc.code        AS destination_country_code,
  dc.flag_emoji  AS destination_flag,
  oc.name        AS origin_country,
  oc.code        AS origin_country_code
`;

// ── Finders ───────────────────────────────────────────────────────────────────

async function findById(id) {
  const applicant = await queryOne(
    `SELECT ${BASE_SELECT}
     FROM applicants a
     LEFT JOIN countries dc ON a.destination_country_id = dc.id
     LEFT JOIN countries oc ON a.origin_country_id      = oc.id
     WHERE a.id = ?`,
    [id]
  );
  if (!applicant) return null;
  applicant.documents = await getDocuments(id);
  return applicant;
}

async function findAll({
  search  = '',
  status  = '',
  gender  = '',
  country = '',
  page    = 1,
  limit   = 25,
  sort    = 'applied_at',
  order   = 'DESC',
} = {}) {
  const safeSorts  = ['applied_at', 'first_name', 'last_name', 'status', 'created_at', 'reference_number'];
  const safeOrders = ['ASC', 'DESC'];
  const sortCol    = safeSorts.includes(sort)              ? `a.${sort}` : 'a.applied_at';
  const sortDir    = safeOrders.includes(order.toUpperCase()) ? order.toUpperCase() : 'DESC';

  const conditions = [];
  const params     = [];

  if (search) {
    conditions.push(
      `(a.first_name LIKE ? OR a.last_name LIKE ? OR a.email LIKE ?
        OR a.reference_number LIKE ? OR a.passport_number LIKE ? OR a.national_id LIKE ?)`
    );
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like);
  }
  if (status)  { conditions.push('a.status = ?');                 params.push(status);  }
  if (gender)  { conditions.push('a.gender = ?');                 params.push(gender);  }
  if (country) { conditions.push('a.destination_country_id = ?'); params.push(country); }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * limit;

  const [rows, countRow] = await Promise.all([
    query(
      `SELECT ${BASE_SELECT}
       FROM applicants a
       LEFT JOIN countries dc ON a.destination_country_id = dc.id
       LEFT JOIN countries oc ON a.origin_country_id      = oc.id
       ${where}
       ORDER BY ${sortCol} ${sortDir}
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    ),
    queryOne(
      `SELECT COUNT(*) AS total FROM applicants a ${where}`,
      params
    ),
  ]);

  return {
    data:       rows,
    total:      countRow?.total || 0,
    page:       Number(page),
    limit:      Number(limit),
    totalPages: Math.ceil((countRow?.total || 0) / limit),
  };
}

async function findByReferenceNumber(ref) {
  return queryOne(
    `SELECT ${BASE_SELECT}
     FROM applicants a
     LEFT JOIN countries dc ON a.destination_country_id = dc.id
     LEFT JOIN countries oc ON a.origin_country_id      = oc.id
     WHERE a.reference_number = ?`,
    [ref]
  );
}

// ── Mutations ─────────────────────────────────────────────────────────────────

async function create(data) {
  const ref = await generateReferenceNumber();

  // ── These must stay in lock-step with the values[] array below ──────────────
  const fields = [
    'reference_number', 'first_name', 'last_name', 'email', 'phone',
    'date_of_birth', 'gender', 'nationality', 'national_id',
    'passport_number', 'passport_expiry',
    'destination_country_id', 'origin_country_id',
    'education', 'experience_years', 'languages', 'skills',
    'address', 'emergency_contact_name', 'emergency_contact_phone',
    'status', 'admin_notes',
  ];

  // ── Every slot uses ?? null so undefined can NEVER reach mysql2 ──────────────
  // Rule: use ?? null for nullable fields, || for fields that need a real default.
  const values = [
    ref,                                        // auto-generated — ignores data.reference_number
    data.first_name             ?? null,
    data.last_name              ?? null,
    data.email                  ?? null,
    data.phone                  ?? null,
    data.date_of_birth          ?? null,        // caller must map 'dob' → 'date_of_birth' before calling
    data.gender                 ?? null,        // ← ROOT CAUSE WAS HERE: was `data.gender` (no fallback)
    data.nationality            ?? null,
    data.national_id            ?? null,
    data.passport_number        ?? null,
    data.passport_expiry        ?? null,
    data.destination_country_id ?? null,        // must be integer FK or null — never a country name string
    data.origin_country_id      ?? null,
    data.education              || 'none',      // || intentional: empty string → 'none'
    data.experience_years       ?? 0,
    data.languages              ?? null,
    data.skills                 ?? null,
    data.address                ?? null,
    data.emergency_contact_name  ?? null,
    data.emergency_contact_phone ?? null,
    data.status                 || 'pending',   // || intentional: empty string → 'pending'
    data.admin_notes            ?? null,
  ];

  // ── Last-resort guard: throw here with a useful message instead of letting
  //    mysql2 throw a cryptic "Bind parameters must not contain undefined" ──────
  fields.forEach((field, i) => {
    if (values[i] === undefined) {
      throw new Error(
        `[Applicant.create] undefined at fields[${i}] = "${field}". ` +
        'The caller must pass null explicitly for missing fields.'
      );
    }
  });

  const placeholders = fields.map(() => '?').join(', ');
  const result = await query(
    `INSERT INTO applicants (${fields.join(', ')}) VALUES (${placeholders})`,
    values
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const allowed = [
    'first_name', 'last_name', 'email', 'phone', 'date_of_birth', 'gender',
    'nationality', 'national_id', 'passport_number', 'passport_expiry',
    'destination_country_id', 'origin_country_id',
    'education', 'experience_years', 'languages', 'skills',
    'address', 'emergency_contact_name', 'emergency_contact_phone',
    'admin_notes',
  ];

  const setClauses = [];
  const params     = [];

  for (const key of allowed) {
    if (key in data) {
      setClauses.push(`${key} = ?`);
      params.push(data[key] === '' ? null : data[key]);
    }
  }

  if (setClauses.length === 0) return findById(id);

  params.push(id);
  await query(`UPDATE applicants SET ${setClauses.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

async function updateStatus(id, status, extra = {}) {
  const allowed = ['pending', 'processing', 'interview', 'approved', 'rejected', 'deployed'];
  if (!allowed.includes(status)) throw new Error(`Invalid status: ${status}`);

  const params = [status];
  let sql = `UPDATE applicants SET status = ?, processed_at = NOW()`;

  if (extra.admin_notes !== undefined) {
    sql += ', admin_notes = ?';
    params.push(extra.admin_notes);
  }
  if (extra.rejected_reason !== undefined) {
    sql += ', rejected_reason = ?';
    params.push(extra.rejected_reason);
  }

  sql += ' WHERE id = ?';
  params.push(id);

  await query(sql, params);
  return findById(id);
}

async function remove(id) {
  await query(`DELETE FROM applicants WHERE id = ?`, [id]);
}

// ── Documents ─────────────────────────────────────────────────────────────────

async function getDocuments(applicantId) {
  return query(
    `SELECT id, document_type, file_path, file_name, file_size, mime_type, uploaded_at
     FROM applicant_documents WHERE applicant_id = ? ORDER BY document_type`,
    [applicantId]
  );
}

async function upsertDocument({ applicant_id, document_type, file_path, file_name, file_size, mime_type }) {
  await query(
    `DELETE FROM applicant_documents WHERE applicant_id = ? AND document_type = ?`,
    [applicant_id, document_type]
  );
  const result = await query(
    `INSERT INTO applicant_documents
       (applicant_id, document_type, file_path, file_name, file_size, mime_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [applicant_id, document_type, file_path, file_name, file_size || null, mime_type || null]
  );
  return queryOne(`SELECT * FROM applicant_documents WHERE id = ?`, [result.insertId]);
}

async function deleteDocument(applicantId, documentType) {
  const doc = await queryOne(
    `SELECT * FROM applicant_documents WHERE applicant_id = ? AND document_type = ?`,
    [applicantId, documentType]
  );
  if (!doc) return null;
  await query(
    `DELETE FROM applicant_documents WHERE applicant_id = ? AND document_type = ?`,
    [applicantId, documentType]
  );
  return doc;
}

// ── Statistics ────────────────────────────────────────────────────────────────

async function getStatusCounts() {
  return query(`SELECT status, COUNT(*) AS count FROM applicants GROUP BY status`);
}

async function getCountryBreakdown() {
  return query(
    `SELECT c.name, c.flag_emoji, COUNT(a.id) AS total,
            SUM(a.status = 'approved') AS approved,
            SUM(a.status = 'rejected') AS rejected,
            SUM(a.status = 'pending')  AS pending
     FROM applicants a
     JOIN countries c ON a.destination_country_id = c.id
     GROUP BY c.id, c.name, c.flag_emoji
     ORDER BY total DESC`
  );
}

async function getMonthlyStats(months = 12) {
  return query(
    `SELECT
       DATE_FORMAT(applied_at, '%Y-%m') AS month,
       COUNT(*) AS total,
       SUM(status = 'approved')  AS approved,
       SUM(status = 'rejected')  AS rejected
     FROM applicants
     WHERE applied_at >= DATE_SUB(NOW(), INTERVAL ? MONTH)
     GROUP BY DATE_FORMAT(applied_at, '%Y-%m')
     ORDER BY month ASC`,
    [months]
  );
}

module.exports = {
  findById,
  findAll,
  findByReferenceNumber,
  create,
  update,
  updateStatus,
  remove,
  getDocuments,
  upsertDocument,
  deleteDocument,
  getStatusCounts,
  getCountryBreakdown,
  getMonthlyStats,
};