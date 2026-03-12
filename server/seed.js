const bcrypt = require('bcryptjs');
const pool = require('./db');

async function seed() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Admin';

  if (!email || !password) {
    console.log('No ADMIN_EMAIL/ADMIN_PASSWORD set, skipping seed');
    return;
  }

  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (rows.length > 0) {
    console.log('Admin user already exists, skipping seed');
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query('INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)', [email, hash, name]);
  console.log(`Admin user created: ${email}`);
}

module.exports = seed;
