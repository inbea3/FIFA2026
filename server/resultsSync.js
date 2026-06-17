const { pool } = require('./db');
const { matchResultKey } = require('./teamNames');
const { settlePendingBets } = require('./schedule');

const DEFAULT_RESULTS_URL =
  process.env.RESULTS_SYNC_URL ||
  'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json';

const SYNC_INTERVAL_MS = Number(process.env.RESULTS_SYNC_INTERVAL_MS || 60 * 60 * 1000);

async function fetchExternalResults(url = DEFAULT_RESULTS_URL) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'FIFAweb/1.0' },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`拉取赛果失败: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.matches || data.fixtures || [];
}

function buildResultMap(externalMatches) {
  const map = new Map();
  for (const match of externalMatches) {
    const score = match.score?.ft;
    if (!Array.isArray(score) || score.length < 2) continue;

    const date = match.date;
    const homeTeam = match.homeTeam || match.team1;
    const awayTeam = match.awayTeam || match.team2;
    if (!date || !homeTeam || !awayTeam) continue;

    const key = matchResultKey(date, homeTeam, awayTeam);
    map.set(key, {
      homeScore: Number(score[0]),
      awayScore: Number(score[1]),
    });
  }
  return map;
}

async function loadDbMatches() {
  const { rows } = await pool.query(`
    SELECT
      match_number,
      match_date::text AS match_date,
      home_team,
      away_team,
      status,
      home_score,
      away_score
    FROM matches
    ORDER BY match_number
  `);
  return rows;
}

async function updateMatchResult(matchNumber, homeScore, awayScore) {
  await pool.query(
    `UPDATE matches
     SET status = 'finished', home_score = $1, away_score = $2
     WHERE match_number = $3`,
    [homeScore, awayScore, matchNumber]
  );
}

async function countPendingBets() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM bets WHERE status = 'pending'");
  return rows[0].count;
}

async function syncResultsFromExternal(options = {}) {
  const url = options.url || DEFAULT_RESULTS_URL;
  const externalMatches = await fetchExternalResults(url);
  const resultMap = buildResultMap(externalMatches);
  const dbMatches = await loadDbMatches();

  let updated = 0;
  let unchanged = 0;
  let noExternal = 0;
  const updatedMatchNumbers = [];

  for (const match of dbMatches) {
    const key = matchResultKey(match.match_date, match.home_team, match.away_team);
    const external = resultMap.get(key);
    if (!external) {
      noExternal += 1;
      continue;
    }

    const sameResult =
      match.status === 'finished' &&
      match.home_score === external.homeScore &&
      match.away_score === external.awayScore;

    if (sameResult) {
      unchanged += 1;
      continue;
    }

    await updateMatchResult(match.match_number, external.homeScore, external.awayScore);
    updated += 1;
    updatedMatchNumbers.push(match.match_number);
  }

  const pendingBefore = await countPendingBets();
  await settlePendingBets();
  const pendingAfter = await countPendingBets();

  return {
    updated,
    unchanged,
    noExternal,
    externalFinished: resultMap.size,
    updatedMatchNumbers,
    settledBets: pendingBefore - pendingAfter,
    pendingBets: pendingAfter,
  };
}

let schedulerTimer = null;
let syncInProgress = false;

function startResultsSyncScheduler() {
  if (schedulerTimer) return;

  console.log(`赛果同步定时任务已启动，间隔 ${SYNC_INTERVAL_MS / 60000} 分钟`);

  schedulerTimer = setInterval(async () => {
    if (syncInProgress) {
      console.log('[赛果同步] 上次同步仍在进行，跳过本次');
      return;
    }

    syncInProgress = true;
    try {
      const result = await syncResultsFromExternal();
      console.log(
        `[赛果同步] 更新 ${result.updated} 场，结算 ${result.settledBets} 注，外部已完赛 ${result.externalFinished} 场`
      );
    } catch (error) {
      console.error('[赛果同步] 失败:', error.message);
    } finally {
      syncInProgress = false;
    }
  }, SYNC_INTERVAL_MS);
}

function stopResultsSyncScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

module.exports = {
  DEFAULT_RESULTS_URL,
  SYNC_INTERVAL_MS,
  fetchExternalResults,
  buildResultMap,
  syncResultsFromExternal,
  startResultsSyncScheduler,
  stopResultsSyncScheduler,
};
