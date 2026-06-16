#!/usr/bin/env node
/** 将 data/schedule.json 导入 Neon PostgreSQL */

const fs = require('fs');
const path = require('path');
const { pool, initSchema } = require('../server/db');

const SCHEDULE_PATH = path.join(__dirname, '..', 'data', 'schedule.json');

async function seed() {
  const raw = fs.readFileSync(SCHEDULE_PATH, 'utf-8');
  const schedule = JSON.parse(raw);

  await initSchema();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM bets');
    await client.query('DELETE FROM transactions');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM matches');
    await client.query('DELETE FROM teams');
    await client.query('DELETE FROM venues');
    await client.query('DELETE FROM tournaments');

    await client.query(
      `INSERT INTO tournaments (id, data) VALUES ($1, $2)`,
      [schedule.tournament.id || 'wc2026-group-stage', schedule.tournament]
    );

    for (const t of schedule.teams) {
      await client.query(
        `INSERT INTO teams (id, name, name_zh, code, flag, fifa_rank, grp, confederation, confederation_zh)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [t.id, t.name, t.nameZh, t.code, t.flag, t.fifaRank, t.group, t.confederation, t.confederationZh]
      );
    }

    for (const v of schedule.venues) {
      await client.query(
        `INSERT INTO venues (id, name, city, city_zh, country, country_zh, timezone, capacity)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [v.id, v.name, v.city, v.cityZh, v.country, v.countryZh, v.timezone, v.capacity]
      );
    }

    for (const m of schedule.matches) {
      await client.query(
        `INSERT INTO matches (
          match_number, match_date, kickoff_utc, stage, stage_zh, grp, matchday, matchday_zh, round,
          home_team, home_team_zh, away_team, away_team_zh,
          stadium, host_city, host_city_zh, host_country, host_country_zh, venue_id,
          status, home_score, away_score
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
        [
          m.matchNumber,
          m.date,
          m.kickoffUtc,
          m.stage,
          m.stageZh,
          m.group,
          m.matchday,
          m.matchdayZh,
          m.round,
          m.homeTeam,
          m.homeTeamZh,
          m.awayTeam,
          m.awayTeamZh,
          m.stadium,
          m.hostCity,
          m.hostCityZh,
          m.hostCountry,
          m.hostCountryZh,
          m.venueId,
          m.status,
          m.homeScore,
          m.awayScore,
        ]
      );
    }

    await client.query('COMMIT');
    console.log(
      `Seeded: 1 tournament, ${schedule.teams.length} teams, ${schedule.venues.length} venues, ${schedule.matches.length} matches`
    );
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((e) => {
  console.error('Seed failed:', e.message);
  process.exit(1);
});
