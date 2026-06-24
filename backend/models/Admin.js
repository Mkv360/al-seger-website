/**
 * models/Admin.js
 *
 * CHANGES FROM PREVIOUS DELIVERY:
 *   - Added: create()    — insert new admin with bcrypt password
 *   - Added: list()      — all admins, with option to include inactive
 *   - Added: setStatus() — activate or deactivate by id
 *   - Added: setRole()   — change role with enum validation
 *   - Added: delete()    — soft-delete (deactivate); preserves audit trail
 */

'use strict';

const bcrypt     = require('bcryptjs');
const { query } = require('../config/db');

const VALID_ROLES = ['super_admin', 'admin', 'viewer'];

class Admin {

  static async findByEmail(email) {
    const rows = await query(
      'SELECT * FROM admins WHERE email = ? LIMIT 1',
      [email.toLowerCase().trim()]
    );
    return rows[0] || null;
  }

  static async findById(id) {
    const rows = await query(
      'SELECT * FROM admins WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    if (!hashedPassword) return false;
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateLastLogin(id) {
    await query('UPDATE admins SET last_login = NOW() WHERE id = ?', [id]);
  }

  static async updatePassword(id, newPassword) {
    const hash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE admins SET password = ? WHERE id = ?', [hash, id]);
  }

  /**
   * Update profile fields: name, email, avatar.
   * Pass avatar: null to clear. Avatar accepts absolute disk path from multer.
   */
  static async update(id, data) {
    const fields = [];
    const values = [];

    if (data.name  != null) { fields.push('name = ?');  values.push(data.name); }
    if (data.email != null) { fields.push('email = ?'); values.push(data.email); }

    if (Object.prototype.hasOwnProperty.call(data, 'avatar')) {
      fields.push('avatar = ?');
      values.push(data.avatar ?? null);
    }

    if (!fields.length) return this.findById(id); // nothing to update

    values.push(id);
    await query(`UPDATE admins SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id); // was findByEmail(data.email||'') — fixed
  }

  // ── Admin management methods (super_admin only) ───────────────────────────

  /**
   * Create a new admin account.
   * Throws 409 if email is already registered.
   */
  static async create({ name, email, password, role = 'admin' }) {
    const existing = await this.findByEmail(email);
    if (existing) {
      const err = new Error('An account with that email already exists.');
      err.status = 409;
      throw err;
    }
    const hash   = await bcrypt.hash(password, 10);
    const result = await query(
      'INSERT INTO admins (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hash, role]
    );
    return this.findById(result.insertId);
  }

  /**
   * List admins. Excludes password column.
   * @param {object} options
   * @param {boolean} options.includeInactive — include deactivated accounts
   */
  static async list({ includeInactive = false } = {}) {
    const where = includeInactive ? '' : 'WHERE is_active = 1';
    return query(
      `SELECT id, name, email, role, avatar, is_active, last_login, created_at
       FROM admins ${where} ORDER BY created_at DESC`
    );
  }

  /**
   * Activate or deactivate an admin.
   */
  static async setStatus(id, isActive) {
    await query(
      'UPDATE admins SET is_active = ? WHERE id = ?',
      [isActive ? 1 : 0, id]
    );
    return this.findById(id);
  }

  /**
   * Change an admin's role.
   * Throws 400 for invalid role values.
   */
  static async setRole(id, role) {
    if (!VALID_ROLES.includes(role)) {
      const err = new Error(`Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.`);
      err.status = 400;
      throw err;
    }
    await query('UPDATE admins SET role = ? WHERE id = ?', [role, id]);
    return this.findById(id);
  }

  /**
   * Soft-delete: deactivate the account.
   * Foreign keys (activity_log, messages, training_materials) use ON DELETE SET NULL,
   * so hard deletion is safe too, but soft-delete preserves audit history.
   */
  static async delete(id) {
    await query('UPDATE admins SET is_active = 0 WHERE id = ?', [id]);
  }
}

module.exports = Admin;