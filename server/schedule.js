const { pool } = require('./db');
const { attachOdds, buildRankMap, settleWdl, settleHandicap } = require('./odds');
const store = require('./store');

const TZ = 'Asia/Shanghai';
/** 开赛前多久停止投注（毫秒） */
const BET_CLOSE_BEFORE_MS = 60 * 60 * 1000;

function formatDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  if (value instanceof Date) {
    // node-pg 将 DATE 解析为本地零点，须用本地日期分量，不能用 UTC
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).slice(0, 10);
}

function getCnParts(date) {
  const d = new Date(date);
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: 'numeric',
      hour12: false,
    }).format(d),
    10
  );
  return { date: dateStr, hour };
}

function formatCnTime(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: TZ,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(date));
}

function parseKickoffUtc(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function kickoffTimestamp(match) {
  if (match.kickoffCnMs != null) return match.kickoffCnMs;
  return new Date(match.kickoffUtc).getTime();
}

function sortByKickoff(matches) {
  return [...matches].sort((a, b) => kickoffTimestamp(a) - kickoffTimestamp(b));
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return formatDateOnly(dt);
}

function enrichKickoffFields(match) {
  const kickoffUtc = parseKickoffUtc(match.kickoffUtc);
  const cn = getCnParts(kickoffUtc);
  return {
    ...match,
    kickoffUtc,
    kickoffCnDate: cn.date,
    kickoffCnTime: formatCnTime(kickoffUtc),
    kickoffCnMs: new Date(kickoffUtc).getTime(),
  };
}

function rowToMatch(row) {
  const base = {
    matchNumber: row.match_number,
    date: formatDateOnly(row.match_date),
    kickoffUtc: parseKickoffUtc(row.kickoff_utc),
    stage: row.stage,
    stageZh: row.stage_zh,
    group: row.grp,
    matchday: row.matchday,
    matchdayZh: row.matchday_zh,
    round: row.round,
    homeTeam: row.home_team,
    homeTeamZh: row.home_team_zh,
    awayTeam: row.away_team,
    awayTeamZh: row.away_team_zh,
    stadium: row.stadium,
    hostCity: row.host_city,
    hostCityZh: row.host_city_zh,
    hostCountry: row.host_country,
    hostCountryZh: row.host_country_zh,
    venueId: row.venue_id,
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
  };
  return enrichKickoffFields(base);
}

async function loadTeams() {
  const { rows } = await pool.query('SELECT * FROM teams ORDER BY grp, fifa_rank');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameZh: r.name_zh,
    code: r.code,
    flag: r.flag,
    fifaRank: r.fifa_rank,
    group: r.grp,
    confederation: r.confederation,
    confederationZh: r.confederation_zh,
  }));
}

async function loadVenues() {
  const { rows } = await pool.query('SELECT * FROM venues ORDER BY name');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    city: r.city,
    cityZh: r.city_zh,
    country: r.country,
    countryZh: r.country_zh,
    timezone: r.timezone,
    capacity: r.capacity,
  }));
}

async function loadMatches() {
  const { rows } = await pool.query(`
    SELECT
      match_number,
      match_date::text AS match_date,
      kickoff_utc,
      stage, stage_zh, grp, matchday, matchday_zh, round,
      home_team, home_team_zh, away_team, away_team_zh,
      stadium, host_city, host_city_zh, host_country, host_country_zh,
      venue_id, status, home_score, away_score
    FROM matches
    ORDER BY kickoff_utc ASC
  `);
  return rows.map(rowToMatch);
}

async function loadTournament() {
  const { rows } = await pool.query('SELECT data FROM tournaments LIMIT 1');
  return rows[0]?.data ?? null;
}

async function loadSchedule() {
  const [tournament, teams, venues, matches] = await Promise.all([
    loadTournament(),
    loadTeams(),
    loadVenues(),
    loadMatches(),
  ]);
  return { tournament, teams, venues, matches };
}

async function settlePendingBets() {
  const [pending, matches] = await Promise.all([store.getPendingBets(), loadMatches()]);
  const matchMap = Object.fromEntries(matches.map((m) => [m.matchNumber, m]));

  for (const bet of pending) {
    const match = matchMap[bet.match_number];
    if (!match || match.status !== 'finished') continue;
    if (match.homeScore == null || match.awayScore == null) continue;

    const won =
      bet.bet_type === 'wdl'
        ? settleWdl(match.homeScore, match.awayScore, bet.selection)
        : settleHandicap(match.homeScore, match.awayScore, bet.handicap, bet.selection);

    const payout = won ? bet.potential_win : 0;
    await store.settleBet(bet.id, won ? 'won' : 'lost', payout);

    if (won) {
      const balance = await store.updateBalance(bet.user_id, payout);
      await store.createTransaction({
        user_id: bet.user_id,
        type: 'win',
        amount: payout,
        balance_after: balance,
        bet_id: bet.id,
        note: `第${bet.match_number}场中奖`,
      });
    }
  }
}

/** 是否属于今日销售日可见场次（北京时间） */
function isOnSalesDay(match, now = new Date()) {
  const kickoff = new Date(match.kickoffUtc);
  const { date: nowCn } = getCnParts(now);
  const { date: kickCn, hour: kickCnHour } = getCnParts(kickoff);
  const tomorrowCn = addDays(nowCn, 1);

  if (kickCn === nowCn) return true;
  if (kickCn === tomorrowCn && kickCnHour < 14) return true;
  return false;
}

/** 当前是否尚未到达「开赛前 1 小时」封盘时点 */
function isBeforeBetClose(match, now = new Date()) {
  const kickoffMs = kickoffTimestamp(match);
  return now.getTime() < kickoffMs - BET_CLOSE_BEFORE_MS;
}

/**
 * 是否可投注：scheduled + 未到开赛前1小时；filterToday 为 true 时还需在销售日内
 */
function isMarketOpen(match, now = new Date(), filterToday = false) {
  if (match.status !== 'scheduled') return false;
  if (!isBeforeBetClose(match, now)) return false;
  if (filterToday && !isOnSalesDay(match, now)) return false;
  return true;
}

function getBetBlockReason(match, now = new Date()) {
  if (match.status !== 'scheduled') return '比赛已开始，已封盘';
  if (!isBeforeBetClose(match, now)) return '开赛前1小时已封盘';
  if (!isOnSalesDay(match, now)) return '该场未开盘';
  return null;
}

function getMarketInfo(now = new Date()) {
  const { date: nowCn } = getCnParts(now);
  const tomorrowCn = addDays(nowCn, 1);
  return {
    timezone: TZ,
    salesDate: nowCn,
    includesDates: [nowCn, tomorrowCn],
    label: `${nowCn} 剩余场次及 ${tomorrowCn} 凌晨/上午场`,
  };
}

async function enrichMatches(schedule, filterOpen = false) {
  const rankMap = buildRankMap(schedule.teams);
  const now = new Date();
  let matches = schedule.matches.map((m) => enrichKickoffFields(attachOdds(m, rankMap)));

  if (filterOpen) {
    matches = matches
      .filter((m) => m.status === 'scheduled' && isOnSalesDay(m, now))
      .map((m) => ({ ...m, marketOpen: isMarketOpen(m, now, false) }));
  }

  return sortByKickoff(matches);
}

module.exports = {
  loadSchedule,
  loadMatches,
  settlePendingBets,
  isMarketOpen,
  isOnSalesDay,
  isBeforeBetClose,
  getBetBlockReason,
  enrichMatches,
  getMarketInfo,
  getCnParts,
  sortByKickoff,
  enrichKickoffFields,
};
