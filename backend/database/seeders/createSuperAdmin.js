/**
 * backend/database/seeders/createSuperAdmin.js
 *
 * CREATES THE FIRST SUPER_ADMIN ACCOUNT
 * ─────────────────────────────────────
 * This script is the ONLY sanctioned way to bootstrap the first admin.
 * It refuses to run if any super_admin already exists, making it safe
 * to accidentally re-run.
 *
 * USAGE (interactive — recommended):
 *   node backend/database/seeders/createSuperAdmin.js
 *
 * USAGE (CI/CD — env vars):
 *   SA_FULL_NAME="Omar Al-Rashid" \
 *   SA_USERNAME="superadmin" \
 *   SA_EMAIL="admin@yourdomain.com" \
 *   SA_PASSWORD="Str0ng#Passw0rd!" \
 *   node backend/database/seeders/createSuperAdmin.js
 *
 * SECURITY NOTES:
 *   • The password is NEVER written to any log, env file, or source.
 *   • bcrypt cost factor is 12 (≈250ms per hash — brute-force resistant).
 *   • A password complexity rule is enforced before hashing.
 *   • The audit_log records creation with no sensitive values.
 *   • Status is set to 'active' directly — no invitation flow needed.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const readline = require('readline');
const crypto   = require('crypto');
const mysql2   = require('mysql2/promise');
const bcrypt   = require('bcryptjs');

const BCRYPT_COST = 12;

// ── Colour helpers (no external dep) ──────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m',
};

const ok   = (msg) => console.log(`${c.green}  ✓${c.reset}  ${msg}`);
const fail = (msg) => console.error(`${c.red}  ✗  ${msg}${c.reset}`);
const info = (msg) => console.log(`${c.cyan}  ›${c.reset}  ${msg}`);
const warn = (msg) => console.log(`${c.yellow}  !  ${msg}${c.reset}`);

// ── Password complexity ────────────────────────────────────────────────────────

function validatePassword(password) {
  const errors = [];
  if (password.length < 12)          errors.push('At least 12 characters');
  if (!/[A-Z]/.test(password))       errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password))       errors.push('At least one lowercase letter');
  if (!/[0-9]/.test(password))       errors.push('At least one number');
  if (!/[^A-Za-z0-9]/.test(password))errors.push('At least one special character (!@#$%^&* etc.)');
  return errors;
}

// ── Username slug generator ────────────────────────────────────────────────────

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .substring(0, 40);
}

// ── Interactive prompt ─────────────────────────────────────────────────────────

function prompt(rl, question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (hidden && process.stdin.isTTY) {
      process.stdout.write(question);
      const wasRaw = process.stdin.isRaw;
      process.stdin.setRawMode(true);
      process.stdin.resume();

      let value = '';
      const handler = (char) => {
        char = char.toString();
        if (char === '\n' || char === '\r' || char === '\u0004') {
          process.stdin.setRawMode(wasRaw);
          process.stdin.pause();
          process.stdin.removeListener('data', handler);
          process.stdout.write('\n');
          resolve(value);
        } else if (char === '\u007f' || char === '\b') {
          if (value.length) {
            value = value.slice(0, -1);
            process.stdout.write('\b \b');
          }
        } else {
          value += char;
          process.stdout.write('*');
        }
      };
      process.stdin.on('data', handler);
    } else {
      rl.question(question, resolve);
    }
  });
}

// ── Database connection ────────────────────────────────────────────────────────

async function getConnection() {
  return mysql2.createConnection({
    host:        process.env.DB_HOST     || 'localhost',
    port:        parseInt(process.env.DB_PORT || '3306', 10),
    database:    process.env.DB_NAME     || 'alseger_db',
    user:        process.env.DB_USER     || 'root',
    password:    process.env.DB_PASSWORD || '',
    timezone:    '+00:00',
    dateStrings: true,
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + c.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' + c.reset);
  console.log(c.bold + '  AL-SEGER — Super Admin Bootstrap Seeder' + c.reset);
  console.log(c.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' + c.reset);

  // ── 1. Connect to DB ────────────────────────────────────────────────────────
  let conn;
  try {
    conn = await getConnection();
    ok('Database connection established');
  } catch (err) {
    fail(`Cannot connect to database: ${err.message}`);
    fail('Check your .env file → DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
    process.exit(1);
  }

  // ── 2. Guard: abort if any super_admin already exists ──────────────────────
  try {
    const [[{ cnt }]] = await conn.execute(
      `SELECT COUNT(*) AS cnt FROM admins WHERE role = 'super_admin'`
    );
    if (cnt > 0) {
      warn('A super_admin already exists. This seeder will not overwrite it.');
      warn('To create additional admins, use the Invite Admin feature in the UI.');
      await conn.end();
      process.exit(0);
    }
  } catch (err) {
    fail(`Cannot query admins table: ${err.message}`);
    fail('Ensure auth_schema.sql has been executed first.');
    await conn.end();
    process.exit(1);
  }

  ok('No existing super_admin found — continuing');
  console.log();

  // ── 3. Collect input (env vars take priority for CI/CD) ────────────────────
  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY,
  });

  let fullName, username, email, password;

  if (process.env.SA_FULL_NAME && process.env.SA_USERNAME &&
      process.env.SA_EMAIL     && process.env.SA_PASSWORD) {
    // Non-interactive / CI mode
    fullName = process.env.SA_FULL_NAME.trim();
    username = process.env.SA_USERNAME.trim();
    email    = process.env.SA_EMAIL.trim().toLowerCase();
    password = process.env.SA_PASSWORD;
    info('Using credentials from environment variables (non-interactive mode)');
  } else {
    // Interactive mode
    info('Enter the super admin details.\n');

    fullName = (await prompt(rl, `  ${c.bold}Full name${c.reset}:   `)).trim();
    if (!fullName) { fail('Full name is required.'); rl.close(); await conn.end(); process.exit(1); }

    const suggestedUsername = slugify(fullName);
    const rawUsername = (await prompt(rl, `  ${c.bold}Username${c.reset}    [${suggestedUsername}]: `)).trim();
    username = rawUsername || suggestedUsername;

    email = (await prompt(rl, `  ${c.bold}Email${c.reset}:       `)).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail('Invalid email address.');
      rl.close();
      await conn.end();
      process.exit(1);
    }

    // Password (two attempts with confirmation)
    let attempts = 0;
    while (true) {
      attempts++;
      if (attempts > 3) {
        fail('Too many password attempts. Exiting.');
        rl.close();
        await conn.end();
        process.exit(1);
      }
      password = await prompt(rl, `  ${c.bold}Password${c.reset}:    `, { hidden: true });
      const errors = validatePassword(password);
      if (errors.length) {
        console.log(`${c.red}    Password requirements not met:${c.reset}`);
        errors.forEach(e => console.log(`    ${c.gray}• ${e}${c.reset}`));
        continue;
      }
      const confirm = await prompt(rl, `  ${c.bold}Confirm${c.reset}:     `, { hidden: true });
      if (password !== confirm) {
        warn('Passwords do not match. Try again.');
        continue;
      }
      break;
    }
  }

  rl.close();

  // ── 4. Final validation ────────────────────────────────────────────────────
  const complexityErrors = validatePassword(password);
  if (complexityErrors.length) {
    fail('Password does not meet complexity requirements:');
    complexityErrors.forEach(e => fail(`  • ${e}`));
    await conn.end();
    process.exit(1);
  }

  // Check email / username uniqueness
  const [[emailRow]] = await conn.execute(
    'SELECT id FROM admins WHERE email = ? LIMIT 1', [email]
  );
  if (emailRow) { fail(`Email '${email}' is already registered.`); await conn.end(); process.exit(1); }

  const [[userRow]] = await conn.execute(
    'SELECT id FROM admins WHERE username = ? LIMIT 1', [username]
  );
  if (userRow) { fail(`Username '${username}' is already taken.`); await conn.end(); process.exit(1); }

  // ── 5. Hash password & insert ──────────────────────────────────────────────
  console.log();
  info(`Hashing password with bcrypt (cost ${BCRYPT_COST}) — please wait…`);
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  ok('Password hashed');

  const [result] = await conn.execute(
    `INSERT INTO admins
       (full_name, username, email, password_hash, role, status,
        must_change_password, created_by)
     VALUES (?, ?, ?, ?, 'super_admin', 'active', 0, NULL)`,
    [fullName, username, email, passwordHash]
  );

  const adminId = result.insertId;
  ok(`Admin record created — id: ${adminId}`);

  // ── 6. Write audit log ────────────────────────────────────────────────────
  await conn.execute(
    `INSERT INTO audit_log
       (admin_id, admin_name, admin_email, action, category, severity,
        entity_type, entity_id, description, ip_address)
     VALUES (?, ?, ?, 'BOOTSTRAP_SUPER_ADMIN', 'admin', 'critical',
             'admin', ?, ?, '127.0.0.1')`,
    [adminId, fullName, email, adminId,
     `First super_admin bootstrapped via CLI seeder. Username: ${username}`]
  );

  ok('Audit log entry written');

  await conn.end();

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log('\n' + c.bold + c.green + '  ✓ Super admin created successfully\n' + c.reset);
  console.log(`  ${c.gray}Name:${c.reset}     ${fullName}`);
  console.log(`  ${c.gray}Username:${c.reset} ${username}`);
  console.log(`  ${c.gray}Email:${c.reset}    ${email}`);
  console.log(`  ${c.gray}Role:${c.reset}     super_admin`);
  console.log(`  ${c.gray}Status:${c.reset}   active`);
  console.log();
  console.log(`  ${c.yellow}Next steps:${c.reset}`);
  console.log(`  1. Start the backend:  npm run dev`);
  console.log(`  2. Open login page and sign in with the credentials above`);
  console.log(`  3. Immediately enable 2FA (when implemented) or change the password if needed`);
  console.log(`  4. Use the Admin Management page to invite other team members`);
  console.log('\n' + c.bold + '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' + c.reset);
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
  if (process.env.NODE_ENV === 'development') console.error(err);
  process.exit(1);
});