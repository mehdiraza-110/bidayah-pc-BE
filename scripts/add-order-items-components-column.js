require('dotenv').config();
const { Pool } = require('pg');

// One-off migration for existing databases: adds the `components` JSONB
// column to `order_items` so bundled orders (e.g. Custom PC Build) can store
// an itemized breakdown of their parts. Safe to run multiple times.
// Fresh installs get this column from schema/schema.sql directly.

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_DATABASE,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function run() {
  try {
    await pool.query(`
      ALTER TABLE order_items
      ADD COLUMN IF NOT EXISTS components JSONB;
    `);
    console.log('order_items.components column is present.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

run();
