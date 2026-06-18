const { pool } = require('./db');

const DEFAULT_ODDS_URL =
  process.env.ODDS_SYNC_URL ||
  'https://webapi.sporttery.cn/gateway/jc/football/getMatchCalculatorV1.qry?poolCode=hhad,had&channel=c';

const SYNC_INTERVAL_MS = Number(process.env.ODDS_SYNC_INTERVAL_MS || 60 * 60 * 1000);
const FALLBACK_SIMULATE = process.env.ODDS_FALLBACK_SIMULATE !== 'false';

/** 体彩中文队名 -> 本地中文队名 */
const SPORTTERY_ZH_TO_LOCAL = {
  韩国: '韩国',
  沙特: '沙特阿拉伯',
  佛得角: '佛得角',
  库拉索: '库拉索',
};

function toLocalZh(name) {
  return SPORTTERY_ZH_TO_LOCAL[name] || name;
}

function parseOddsValue(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function buildOddsBlock(had, hhad) {
  const wdlHome = parseOddsValue(had?.h);
  const wdlDraw = parseOddsValue(had?.d);
  const wdlAway = parseOddsValue(had?.a);
  if (wdlHome == null && wdlDraw == null && wdlAway == null) return null;
  if (wdlHome == null || wdlDraw == null || wdlAway == null) return null;

  const lineRaw = hhad?.goalLineValue ?? hhad?.goalLine;
  const line = lineRaw != null && lineRaw !== '' ? parseFloat(lineRaw) : null;
  const hHome = parseOddsValue(hhad?.h);
  const hDraw = parseOddsValue(hhad?.d);
  const hAway = parseOddsValue(hhad?.a);

  const odds = {
    wdl: {
      home: wdlHome,
      draw: wdlDraw,
      away: wdlAway,
      labels: { home: '胜', draw: '平', away: '负' },
    },
  };

  if (line != null && hHome != null && hDraw != null && hAway != null) {
    odds.handicap = {
      line,
      lineLabel: line > 0 ? `+${line}` : `${line}`,
      home: hHome,
      draw: hDraw,
      away: hAway,
      labels: { home: '让胜', draw: '让平', away: '让负' },
    };
  }

  return odds;
}

function sportteryListKey(homeZh, awayZh, matchDate) {
  return `${toLocalZh(homeZh)}|${toLocalZh(awayZh)}|${matchDate}`;
}

async function fetchSportteryCalculator(url = DEFAULT_ODDS_URL) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Referer: 'https://www.sporttery.cn/',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    throw new Error(`拉取体彩赔率失败: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.errorMessage || '体彩接口返回失败');
  }
  return data.value?.matchInfoList || [];
}

function buildSportteryMap(matchInfoList) {
  const map = new Map();
  for (const day of matchInfoList) {
    for (const m of day.subMatchList || []) {
      if (!m.homeTeamAbbName || !m.awayTeamAbbName || !m.matchDate) continue;
      const key = sportteryListKey(m.homeTeamAbbName, m.awayTeamAbbName, m.matchDate);
      map.set(key, m);
    }
  }
  return map;
}

async function loadDbMatchesForOdds() {
  const { rows } = await pool.query(`
    SELECT match_number, home_team_zh, away_team_zh, kickoff_utc, status
    FROM matches
    ORDER BY match_number
  `);
  return rows;
}

async function upsertMatchOdds(matchNumber, odds, sportteryMatchId) {
  const h = odds.handicap;
  await pool.query(
    `INSERT INTO match_odds (
      match_number, wdl_home, wdl_draw, wdl_away,
      handicap_line, handicap_home, handicap_draw, handicap_away,
      sporttery_match_id, updated_at, source
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),'sporttery')
    ON CONFLICT (match_number) DO UPDATE SET
      wdl_home = EXCLUDED.wdl_home,
      wdl_draw = EXCLUDED.wdl_draw,
      wdl_away = EXCLUDED.wdl_away,
      handicap_line = EXCLUDED.handicap_line,
      handicap_home = EXCLUDED.handicap_home,
      handicap_draw = EXCLUDED.handicap_draw,
      handicap_away = EXCLUDED.handicap_away,
      sporttery_match_id = EXCLUDED.sporttery_match_id,
      updated_at = NOW(),
      source = 'sporttery'`,
    [
      matchNumber,
      odds.wdl.home,
      odds.wdl.draw,
      odds.wdl.away,
      h?.line ?? null,
      h?.home ?? null,
      h?.draw ?? null,
      h?.away ?? null,
      sportteryMatchId ?? null,
    ]
  );
}

async function syncOddsFromSporttery(options = {}) {
  const { getCnParts } = require('./schedule');
  const url = options.url || DEFAULT_ODDS_URL;
  const matchInfoList = await fetchSportteryCalculator(url);
  const externalMap = buildSportteryMap(matchInfoList);
  const dbMatches = await loadDbMatchesForOdds();

  let updated = 0;
  let skipped = 0;
  let noExternal = 0;
  const updatedMatchNumbers = [];

  for (const row of dbMatches) {
    if (row.status !== 'scheduled') {
      skipped += 1;
      continue;
    }

    const cnDate = getCnParts(row.kickoff_utc).date;
    const key = sportteryListKey(row.home_team_zh, row.away_team_zh, cnDate);
    const ext = externalMap.get(key);
    if (!ext) {
      noExternal += 1;
      continue;
    }

    const odds = buildOddsBlock(ext.had, ext.hhad);
    if (!odds) {
      noExternal += 1;
      continue;
    }

    await upsertMatchOdds(row.match_number, odds, ext.matchId);
    updated += 1;
    updatedMatchNumbers.push(row.match_number);
  }

  try {
    const { invalidateOddsCache } = require('./odds');
    invalidateOddsCache();
  } catch (_) {
    /* ignore */
  }

  return {
    updated,
    skipped,
    noExternal,
    externalTotal: externalMap.size,
    updatedMatchNumbers,
  };
}

let schedulerTimer = null;
let syncInProgress = false;

function startOddsSyncScheduler() {
  if (schedulerTimer) return;

  console.log(`体彩赔率同步定时任务已启动，间隔 ${SYNC_INTERVAL_MS / 60000} 分钟`);

  schedulerTimer = setInterval(async () => {
    if (syncInProgress) {
      console.log('[赔率同步] 上次同步仍在进行，跳过本次');
      return;
    }
    syncInProgress = true;
    try {
      const result = await syncOddsFromSporttery();
      console.log(`[赔率同步] 更新 ${result.updated} 场，体彩在售 ${result.externalTotal} 场`);
    } catch (error) {
      console.error('[赔率同步] 失败:', error.message);
    } finally {
      syncInProgress = false;
    }
  }, SYNC_INTERVAL_MS);
}

function stopOddsSyncScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

module.exports = {
  DEFAULT_ODDS_URL,
  SYNC_INTERVAL_MS,
  FALLBACK_SIMULATE,
  fetchSportteryCalculator,
  syncOddsFromSporttery,
  startOddsSyncScheduler,
  stopOddsSyncScheduler,
};
