// test-hash.js

const bcrypt = require('bcryptjs');

const hash = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBa5...'; // full hash from DB

bcrypt.compare('Admin@123', hash)
  .then(result => console.log(result));