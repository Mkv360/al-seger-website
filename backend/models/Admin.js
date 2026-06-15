'use strict';

const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

class Admin {

  static async findByEmail(email) {
    const rows = await query(
      'SELECT * FROM admins WHERE email = ? LIMIT 1',
      [email]
    );
    return rows[0] || null;
  }

  static async verifyPassword(plainPassword, hashedPassword) {
    if (!hashedPassword) return false;
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static async updateLastLogin(id) {
    await query(
      'UPDATE admins SET last_login = NOW() WHERE id = ?',
      [id]
    );
  }

  static async updatePassword(id, newPassword) {
    const hash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE admins SET password = ? WHERE id = ?',
      [hash, id]
    );
  }
static async findById(id) {
  const rows = await query(
    'SELECT * FROM admins WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}
  static async update(id, data) {
    const fields = [];
    const values = [];

    if (data.name) {
      fields.push('name = ?');
      values.push(data.name);
    }

    if (data.email) {
      fields.push('email = ?');
      values.push(data.email);
    }

    if (!fields.length) return null;

    values.push(id);

    await query(
      `UPDATE admins SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    return this.findByEmail(data.email || '');
  }
}

module.exports = Admin;