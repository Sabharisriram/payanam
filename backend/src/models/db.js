const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
  } else {
    console.log('Connected to Supabase PostgreSQL');
    runMigrations();
  }
});

async function runMigrations() {
  const migrations = [
    `ALTER TABLE trips ADD COLUMN IF NOT EXISTS trip_days INTEGER DEFAULT 1`,
    `ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS day_number INTEGER DEFAULT 1`,
    `ALTER TABLE trips ADD COLUMN IF NOT EXISTS planning_mode TEXT DEFAULT 'sightseeing'`,
    `ALTER TABLE trips ADD COLUMN IF NOT EXISTS custom_places TEXT`,
    `ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS stop_lat FLOAT`,
    `ALTER TABLE trip_stops ADD COLUMN IF NOT EXISTS stop_lng FLOAT`,
  ];
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      console.error('Migration failed:', sql, err.message);
    }
  }
  console.log('Migrations applied');
}

module.exports = pool;