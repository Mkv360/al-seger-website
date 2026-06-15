/**
 * debug-login.js
 * Drop this in your /backend directory and run:
 *   node debug-login.js
 *
 * It will tell you EXACTLY why the 401 is happening.
 * DELETE this file once the issue is resolved.
 */

'use strict';
require('dotenv').config();

const Admin = require('./models/Admin');

// ─── EDIT THESE TWO LINES ───────────────────────────────────────────────────
const TEST_EMAIL    = 'admin@alseger.com';   // what you type in the login form
const TEST_PASSWORD = 'Admin@123';         // what you type in the login form
// ────────────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n══════════════════════════════════════');
  console.log('  Login Debugger');
  console.log('══════════════════════════════════════');
  console.log(`  Email    : ${TEST_EMAIL}`);
  console.log(`  Password : ${'*'.repeat(TEST_PASSWORD.length)}`);
  console.log('──────────────────────────────────────\n');

  // ── Step 1: email lookup ─────────────────────────────────────────
  let admin;
  try {
    admin = await require('./models/Admin').findByEmail(TEST_EMAIL);
  } catch (err) {
    console.error('❌  DB query failed:', err.message);
    console.log('\n   → Check your .env DB credentials and that the server is running.');
    process.exit(1);
  }

  if (!admin) {
    console.log('❌  STEP 1 FAILED — Email not found in admins table.');
    console.log(`   Searched for : "${TEST_EMAIL.toLowerCase().trim()}"`);
    console.log('   → Run this SQL to see what emails are actually stored:');
    console.log('     SELECT id, email, is_active FROM admins;\n');
    process.exit(1);
  }

  console.log('✅  STEP 1 PASSED — Admin row found:');
  console.log(`    id        : ${admin.id}`);
  console.log(`    name      : ${admin.name}`);
  console.log(`    email     : ${admin.email}`);
  console.log(`    role      : ${admin.role}`);
  console.log(`    is_active : ${admin.is_active}`);
  console.log(`    hash len  : ${admin.password?.length ?? 'NULL'} chars  (must be 60)\n`);

  // ── Step 2: is_active check ──────────────────────────────────────
  if (!admin.is_active) {
    console.log('❌  STEP 2 FAILED — Account is deactivated (is_active = 0).');
    console.log('   → Fix:  UPDATE admins SET is_active = 1 WHERE id = ' + admin.id + ';\n');
    process.exit(1);
  }
  console.log('✅  STEP 2 PASSED — Account is active.\n');

  // ── Step 3: hash integrity ───────────────────────────────────────
  if (!admin.password || admin.password.length < 60) {
    console.log('❌  STEP 3 FAILED — Stored hash is missing or truncated.');
    console.log(`   Hash length is ${admin.password?.length ?? 0}, bcrypt needs exactly 60 chars.`);
    console.log('   → Check: SHOW COLUMNS FROM admins LIKE "password";');
    console.log('   → Column must be VARCHAR(255) or at minimum VARCHAR(60).\n');
    process.exit(1);
  }
  console.log('✅  STEP 3 PASSED — Hash length is valid (60 chars).\n');

  // ── Step 4: password verification ───────────────────────────────
  let valid;
  try {
    valid = await Admin.verifyPassword(TEST_PASSWORD, admin.password);
  } catch (err) {
    console.error('❌  bcrypt.compare threw an error:', err.message);
    process.exit(1);
  }

  if (!valid) {
    console.log('❌  STEP 4 FAILED — Password does NOT match the stored hash.');
    console.log('   The bcrypt hash in the DB does not match what you typed.');
    console.log('\n   Possible causes:');
    console.log('   1. You are using the wrong password — check createSuperAdmin.js');
    console.log('      for the exact string that was hashed when the seeder ran.');
    console.log('   2. The password column was VARCHAR < 60 when the admin was');
    console.log('      created, truncating the hash. Re-hash and update:');
    console.log();
    console.log('      node -e "');
    console.log(`        const b = require('bcryptjs');`);
    console.log(`        b.hash('NewPassword@1', 12).then(h => console.log(h));`);
    console.log('      "');
    console.log('      Then: UPDATE admins SET password = "<hash>" WHERE id = ' + admin.id + ';');
    console.log();
    process.exit(1);
  }

  // ── All checks passed ────────────────────────────────────────────
  console.log('✅  STEP 4 PASSED — Password matches.\n');
  console.log('══════════════════════════════════════');
  console.log('  ✅  All checks passed. The credentials are correct.');
  console.log('  If you still get 401 from the browser, the issue is');
  console.log('  either the activity_log INSERT throwing (use the fixed');
  console.log('  authController.js) or a frontend form ID mismatch.');
  console.log('══════════════════════════════════════\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});