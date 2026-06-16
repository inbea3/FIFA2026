const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_zh TEXT,
      code TEXT,
      flag TEXT,
      fifa_rank INT,
      grp CHAR(1),
      confederation TEXT,
      confederation_zh TEXT
    );

    CREATE TABLE IF NOT EXISTS venues (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT,
      city_zh TEXT,
      country TEXT,
      country_zh TEXT,
      timezone TEXT,
      capacity INT
    );

    CREATE TABLE IF NOT EXISTS matches (
      match_number INT PRIMARY KEY,
      match_date DATE NOT NULL,
      kickoff_utc TIMESTAMPTZ NOT NULL,
      stage TEXT,
      stage_zh TEXT,
      grp CHAR(1),
      matchday INT,
      matchday_zh TEXT,
      round TEXT,
      home_team TEXT NOT NULL,
      home_team_zh TEXT,
      away_team TEXT NOT NULL,
      away_team_zh TEXT,
      stadium TEXT,
      host_city TEXT,
      host_city_zh TEXT,
      host_country TEXT,
      host_country_zh TEXT,
      venue_id TEXT,
      status TEXT NOT NULL DEFAULT 'scheduled',
      home_score INT,
      away_score INT
    );

    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      balance NUMERIC(12, 2) NOT NULL DEFAULT 1000,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS bets (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      match_number INT NOT NULL REFERENCES matches(match_number),
      bet_type TEXT NOT NULL,
      selection TEXT NOT NULL,
      handicap NUMERIC(4, 1),
      odds NUMERIC(8, 2) NOT NULL,
      stake NUMERIC(12, 2) NOT NULL,
      potential_win NUMERIC(12, 2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      payout NUMERIC(12, 2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      settled_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      balance_after NUMERIC(12, 2) NOT NULL,
      bet_id INT REFERENCES bets(id),
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_matches_date ON matches(match_date);
    CREATE INDEX IF NOT EXISTS idx_bets_user ON bets(user_id);
    CREATE INDEX IF NOT EXISTS idx_bets_status ON bets(status);
  `);
}

function getPool() {
  return pool;
}

module.exports = { pool, getPool, initSchema };
