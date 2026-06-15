/**
 * models/Country.js
 * Data-access layer for the countries table.
 */

'use strict';

const { query, queryOne } = require('../config/db');

// ── Finders ───────────────────────────────────────────────────────────────────

async function findAll({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE is_active = 1' : '';
  return query(
    `SELECT id, name, code, flag_emoji, region, quota, is_active, notes,
            created_at, updated_at
     FROM countries ${where} ORDER BY name ASC`
  );
}

async function findById(id) {
  return queryOne(
    `SELECT id, name, code, flag_emoji, region, quota, is_active, notes,
            created_at, updated_at
     FROM countries WHERE id = ?`,
    [id]
  );
}

async function findByCode(code) {
  return queryOne(
    `SELECT * FROM countries WHERE code = ? LIMIT 1`,
    [code.toUpperCase()]
  );
}

async function findWithStats() {
  return query(
    `SELECT
       c.id, c.name, c.code, c.flag_emoji, c.region, c.quota, c.is_active,
       COUNT(a.id)                     AS total_applicants,
       SUM(a.status = 'approved')      AS approved,
       SUM(a.status = 'rejected')      AS rejected,
       SUM(a.status = 'pending')       AS pending,
       SUM(a.status = 'deployed')      AS deployed,
       ROUND(c.quota - COALESCE(SUM(a.status = 'approved'),0), 0) AS remaining_quota
     FROM countries c
     LEFT JOIN applicants a ON a.destination_country_id = c.id
     GROUP BY c.id
     ORDER BY c.name ASC`
  );
}

// ── Mutations ─────────────────────────────────────────────────────────────────

async function create({ name, code, flag_emoji, region, quota = 0, is_active = true, notes }) {
  const result = await query(
    `INSERT INTO countries (name, code, flag_emoji, region, quota, is_active, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [name, code.toUpperCase(), flag_emoji || null, region || null, quota, is_active ? 1 : 0, notes || null]
  );
  return findById(result.insertId);
}

async function update(id, data) {
  const allowed  = ['name', 'code', 'flag_emoji', 'region', 'quota', 'is_active', 'notes'];
  const setClauses = [];
  const params   = [];

  for (const key of allowed) {
    if (key in data) {
      setClauses.push(`${key} = ?`);
      params.push(key === 'code' && data[key] ? data[key].toUpperCase() : data[key]);
    }
  }
  if (setClauses.length === 0) return findById(id);
  params.push(id);
  await query(`UPDATE countries SET ${setClauses.join(', ')} WHERE id = ?`, params);
  return findById(id);
}

async function remove(id) {
  // Check if country is in use
  const row = await queryOne(
    `SELECT COUNT(*) AS cnt FROM applicants WHERE destination_country_id = ? OR origin_country_id = ?`,
    [id, id]
  );
  if (row?.cnt > 0) {
    const err = new Error('Country is in use by one or more applicants and cannot be deleted.');
    err.status = 409;
    throw err;
  }
  await query(`DELETE FROM countries WHERE id = ?`, [id]);
}

module.exports = { findAll, findById, findByCode, findWithStats, create, update, remove };