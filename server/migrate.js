const pool = require('./db');

const SQL = `
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS valuations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name VARCHAR(255) NOT NULL DEFAULT '',
    customer_address TEXT DEFAULT '',
    valuation_date DATE,
    schedule_html TEXT DEFAULT '',
    pricing_rows JSONB DEFAULT '[]',
    total_range VARCHAR(255) DEFAULT '',
    insurance_value VARCHAR(255) DEFAULT '',
    number_of_items VARCHAR(50) DEFAULT '1',
    images JSONB DEFAULT '[]',
    owner_signature TEXT DEFAULT '',
    status VARCHAR(20) DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS valuations_customer_idx ON valuations(customer_name);
  CREATE INDEX IF NOT EXISTS valuations_date_idx ON valuations(valuation_date);
  CREATE INDEX IF NOT EXISTS valuations_status_idx ON valuations(status);
`;

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(SQL);
    console.log('Database migration completed');
  } finally {
    client.release();
  }
}

module.exports = migrate;
