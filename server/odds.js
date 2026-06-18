/**
 * 赔率：优先使用数据库中的体彩同步赔率，可选回退到模拟算法
 */

const { pool } = require('./db');

const FALLBACK_SIMULATE = process.env.ODDS_FALLBACK_SIMULATE !== 'false';

const TEAM_ALIASES = {
  'Korea Republic': 'South Korea',
  'Bosnia and Herzegovina': 'Bosnia & Herzegovina',
  'United States': 'United States',
  Turkiye: 'Türkiye',
  "Cote d'Ivoire": 'Ivory Coast',
  Curacao: 'Curaçao',
  'Cabo Verde': 'Cape Verde',
  'IR Iran': 'Iran',
  'Congo DR': 'DR Congo',
  Czechia: 'Czechia',
};

function normalizeTeam(name) {
  return TEAM_ALIASES[name] || name;
}

function buildRankMap(teams) {
  const map = {};
  for (const t of teams) {
    map[t.name] = t.fifaRank;
    map[normalizeTeam(t.name)] = t.fifaRank;
  }
  return map;
}

function roundOdds(v) {
  return Math.max(1.12, Math.min(18.0, Math.round(v * 100) / 100));
}

function impliedProbs(homeRank, awayRank) {
  const diff = awayRank - homeRank;
  const homeAdv = 0.08;
  let pHome = 1 / (1 + Math.exp(-(diff * 0.06 + homeAdv)));
  let pDraw = 0.24 - Math.min(0.08, Math.abs(diff) * 0.003);
  pDraw = Math.max(0.14, Math.min(0.32, pDraw));
  let pAway = 1 - pHome - pDraw;
  if (pAway < 0.08) {
    pAway = 0.08;
    const scale = (1 - pAway) / (pHome + pDraw);
    pHome *= scale;
    pDraw *= scale;
  }
  const total = pHome + pDraw + pAway;
  return { home: pHome / total, draw: pDraw / total, away: pAway / total };
}

function probsToOdds(probs, returnRate = 0.72) {
  return {
    home: roundOdds(returnRate / probs.home),
    draw: roundOdds(returnRate / probs.draw),
    away: roundOdds(returnRate / probs.away),
  };
}

function pickHandicap(homeRank, awayRank) {
  const diff = awayRank - homeRank;
  if (diff >= 35) return -2;
  if (diff >= 18) return -1;
  if (diff <= -35) return 2;
  if (diff <= -18) return 1;
  if (diff >= 8) return -1;
  if (diff <= -8) return 1;
  return -1;
}

function handicapProbs(homeRank, awayRank, line) {
  const base = impliedProbs(homeRank, awayRank);
  const shift = line * 0.04;
  let pHome = base.home + shift;
  let pAway = base.away - shift;
  let pDraw = base.draw;
  pHome = Math.max(0.1, Math.min(0.75, pHome));
  pAway = Math.max(0.1, Math.min(0.75, pAway));
  pDraw = Math.max(0.12, 1 - pHome - pAway);
  const total = pHome + pDraw + pAway;
  return { home: pHome / total, draw: pDraw / total, away: pAway / total };
}

function simulateOdds(match, rankMap) {
  const homeRank = rankMap[normalizeTeam(match.homeTeam)] ?? rankMap[match.homeTeam] ?? 50;
  const awayRank = rankMap[normalizeTeam(match.awayTeam)] ?? rankMap[match.awayTeam] ?? 50;
  const probs = impliedProbs(homeRank, awayRank);
  const wdl = probsToOdds(probs);
  const handicap = pickHandicap(homeRank, awayRank);
  const hProbs = handicapProbs(homeRank, awayRank, handicap);
  const hdl = probsToOdds(hProbs);

  return {
    wdl: {
      home: wdl.home,
      draw: wdl.draw,
      away: wdl.away,
      labels: { home: '胜', draw: '平', away: '负' },
    },
    handicap: {
      line: handicap,
      lineLabel: handicap > 0 ? `+${handicap}` : `${handicap}`,
      home: hdl.home,
      draw: hdl.draw,
      away: hdl.away,
      labels: { home: '让胜', draw: '让平', away: '让负' },
    },
  };
}

function rowToOddsBlock(row) {
  const odds = {
    wdl: {
      home: parseFloat(row.wdl_home),
      draw: parseFloat(row.wdl_draw),
      away: parseFloat(row.wdl_away),
      labels: { home: '胜', draw: '平', away: '负' },
    },
  };

  if (row.handicap_line != null && row.handicap_home != null) {
    const line = parseFloat(row.handicap_line);
    odds.handicap = {
      line,
      lineLabel: line > 0 ? `+${line}` : `${line}`,
      home: parseFloat(row.handicap_home),
      draw: parseFloat(row.handicap_draw),
      away: parseFloat(row.handicap_away),
      labels: { home: '让胜', draw: '让平', away: '让负' },
    };
  }

  return odds;
}

let oddsCache = null;
let oddsCacheAt = 0;
const ODDS_CACHE_MS = 30 * 1000;

async function loadOddsMap(force = false) {
  const now = Date.now();
  if (!force && oddsCache && now - oddsCacheAt < ODDS_CACHE_MS) {
    return oddsCache;
  }
  const { rows } = await pool.query('SELECT * FROM match_odds');
  oddsCache = Object.fromEntries(rows.map((r) => [r.match_number, rowToOddsBlock(r)]));
  oddsCacheAt = now;
  return oddsCache;
}

function invalidateOddsCache() {
  oddsCache = null;
  oddsCacheAt = 0;
}

function attachOdds(match, rankMap, oddsMap = {}) {
  const real = oddsMap[match.matchNumber];
  if (real) {
    return { ...match, odds: real, oddsSource: 'sporttery' };
  }
  if (FALLBACK_SIMULATE && rankMap) {
    return { ...match, odds: simulateOdds(match, rankMap), oddsSource: 'simulated' };
  }
  return {
    ...match,
    odds: null,
    oddsSource: 'unavailable',
  };
}

function settleWdl(homeScore, awayScore, selection) {
  const result = homeScore > awayScore ? 'home' : homeScore === awayScore ? 'draw' : 'away';
  return result === selection;
}

function settleHandicap(homeScore, awayScore, line, selection) {
  const adjusted = homeScore + line - awayScore;
  const result = adjusted > 0 ? 'home' : adjusted === 0 ? 'draw' : 'away';
  return result === selection;
}

module.exports = {
  buildRankMap,
  loadOddsMap,
  invalidateOddsCache,
  attachOdds,
  simulateOdds,
  settleWdl,
  settleHandicap,
};
