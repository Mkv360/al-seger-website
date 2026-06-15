/**
 * config/db.js
 * MySQL connection pool using mysql2/promise.
 * Exports a pre-connected pool ready for use in models and controllers.
 */

'use strict';

const mysql = require('mysql2/promise');

// ── Pool configuration ────────────────────────────────────────────────────────
const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               parseInt(process.env.DB_PORT || '3306', 10),
  database:           process.env.DB_NAME     || 'alseger_db',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit:    20,
  queueLimit:         0,
  enableKeepAlive:    true,
  keepAliveInitialDelay: 0,
  // Return dates as strings so we control formatting
  dateStrings:        true,
  timezone:           '+00:00',
});

// ── Test connection on startup ────────────────────────────────────────────────
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log(`✅  MySQL connected  →  ${process.env.DB_HOST}:${process.env.DB_PORT || 3306} / ${process.env.DB_NAME}`);
    conn.release();
  } catch (err) {
    console.error('❌  MySQL connection failed:', err);
    process.exit(1);
  }
}

// ── Helper: run a query with automatic logging in dev mode ───────────────────
async function query(sql, params = []) {
  if (process.env.NODE_ENV === 'development') {
    // Show a trimmed version of the query for debugging
    console.debug('[SQL]', sql.replace(/\s+/g, ' ').substring(0, 120));
  }
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ── Helper: single-row fetch ──────────────────────────────────────────────────
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

// ── Helper: begin / commit / rollback wrapper ─────────────────────────────────
async function withTransaction(callback) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  pool,
  query,
  queryOne,
  withTransaction,
  testConnection,
};