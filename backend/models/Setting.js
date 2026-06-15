/**
 * models/Setting.js
 * Key-value settings with typed value casting.
 */

'use strict';

const { query, queryOne } = require('../config/db');

// ── Type casting ──────────────────────────────────────────────────────────────

function castValue(raw, type) {
  if (raw === null || raw === undefined) return null;
  switch (type) {
    case 'number':  return Number(raw);
    case 'boolean': return raw === 'true' || raw === '1' || raw === true;
    case 'json':    try { return JSON.parse(raw); } catch { return raw; }
    default:        return String(raw);
  }
}

// ── Finders ───────────────────────────────────────────────────────────────────

async function findAll({ group } = {}) {
  let sql = `SELECT id, key_name, value, value_type, label, group_name, updated_at
             FROM settings`;
  const params = [];
  if (group) { sql += ' WHERE group_name = ?'; params.push(group); }
  sql += ' ORDER BY group_name, key_name';
  const rows = await query(sql, params);
  return rows.map((r) => ({ ...r, typed_value: castValue(r.value, r.value_type) }));
}

async function findByKey(key) {
  const row = await queryOne(
    `SELECT id, key_name, value, value_type, label, group_name, updated_at
     FROM settings WHERE key_name = ?`,
    [key]
  );
  if (!row) return null;
  return { ...row, typed_value: castValue(row.value, row.value_type) };
}

/** Returns a plain { key: typedValue } map for easy config consumption */
async function getMap() {
  const rows = await findAll();
  return rows.reduce((acc, r) => {
    acc[r.key_name] = r.typed_value;
    return acc;
  }, {});
}

// ── Mutations ─────────────────────────────────────────────────────────────────

async function upsert(key, value) {
  const existing = await findByKey(key);
  if (!existing) {
    throw new Error(`Setting key '${key}' does not exist.`);
  }
  // Serialize json values
  const serialized = existing.value_type === 'json'
    ? JSON.stringify(value)
    : String(value);
  await query(
    `UPDATE settings SET value = ? WHERE key_name = ?`,
    [serialized, key]
  );
  return findByKey(key);
}

async function bulkUpdate(entries) {
  // entries: [{ key, value }]
  const results = [];
  for (const { key, value } of entries) {
    const updated = await upsert(key, value);
    results.push(updated);
  }
  return results;
}

module.exports = { findAll, findByKey, getMap, upsert, bulkUpdate };