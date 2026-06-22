'use strict';

const bcrypt       = require('bcryptjs');
const { query }    = require('../config/db');

// Defined once here. Every password hashed in this system uses this cost factor.
// Matches the cost factor used in createSuperAdmin.js for consistency.
const BCRYPT_COST = 12;

class User {

  // ── findByPhoneOrEmail ────────────────────────────────────────────────────────
  // Looks up a user by their login identifier (phone number or email address).
  //
  // Called by:
  //   • userAuthController.register — to check for duplicate accounts before insert
  //   • userAuthController.login    — to fetch the row for password verification
  //
  // Returns: full user row (including password_hash) or null if not found.
  // The caller is responsible for not exposing password_hash in responses.
  // ─────────────────────────────────────────────────────────────────────────────
  static async findByPhoneOrEmail(identifier) {
    const rows = await query(
      'SELECT * FROM users WHERE phone_or_email = ? LIMIT 1',
      [identifier.trim()]
    );
    return rows[0] || null;
  }

  // ── findById ──────────────────────────────────────────────────────────────────
  // Looks up a user by primary key.
  //
  // Called by:
  //   • authenticateUser middleware — after JWT decode to confirm account exists
  //   • User.create               — to return the full row after INSERT
  //
  // Returns: full user row or null if not found.
  // ─────────────────────────────────────────────────────────────────────────────
  static async findById(id) {
    const rows = await query(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  }

  // ── create ────────────────────────────────────────────────────────────────────
  // Inserts a new user row into the users table.
  //
  // Called by:
  //   • userAuthController.register — after input validation and password hashing
  //
  // Expects:
  //   { full_name, phone_or_email, gender, password_hash }
  //   password_hash must already be hashed — call User.hashPassword() first.
  //
  // Returns: the complete newly-created user row, including generated id and
  //          timestamps, fetched via findById after the INSERT.
  // ─────────────────────────────────────────────────────────────────────────────
  static async create({ full_name, phone_or_email, gender, password_hash }) {
    const result = await query(
      `INSERT INTO users (full_name, phone_or_email, gender, password_hash)
       VALUES (?, ?, ?, ?)`,
      [
        full_name.trim(),
        phone_or_email.trim(),
        gender,
        password_hash,
      ]
    );
    return this.findById(result.insertId);
  }

  // ── hashPassword ──────────────────────────────────────────────────────────────
  // Hashes a plain-text password using bcrypt.
  //
  // Called by:
  //   • userAuthController.register — before passing hash to User.create()
  //
  // The cost factor is defined at the top of this file (BCRYPT_COST = 12).
  // It is not hardcoded in the controller so there is exactly one place to
  // change it if requirements change.
  // ─────────────────────────────────────────────────────────────────────────────
  static async hashPassword(plainPassword) {
    return bcrypt.hash(plainPassword, BCRYPT_COST);
  }

  // ── verifyPassword ────────────────────────────────────────────────────────────
  // Compares a plain-text password against a stored bcrypt hash.
  //
  // Called by:
  //   • userAuthController.login — to authenticate a returning user
  //
  // Returns: boolean. Returns false (not an error) if hash is missing,
  // which handles edge cases like accounts created without passwords gracefully.
  // ─────────────────────────────────────────────────────────────────────────────
  static async verifyPassword(plainPassword, hashedPassword) {
    if (!hashedPassword) return false;
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // ── safeUser ──────────────────────────────────────────────────────────────────
  // Returns a copy of the user object with password_hash removed.
  //
  // Called by:
  //   • userAuthController.register — before including user in the response
  //   • userAuthController.login    — before including user in the response
  //   • userAuthController.getMe    — before including user in the response
  //   • authenticateUser middleware  — before attaching user to req.user
  //
  // The password hash must never travel outside the server.
  // This method is the single enforcement point for that rule.
  // ─────────────────────────────────────────────────────────────────────────────
  static safeUser(user) {
    if (!user) return null;
    const { password_hash, ...safe } = user;
    return safe;
  }
}

module.exports = User;