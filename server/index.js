const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initSchema } = require('./db');
const store = require('./store');
const {
  loadSchedule,
  settlePendingBets,
  isMarketOpen,
  getBetBlockReason,
  enrichMatches,
  getMarketInfo,
  sortByKickoff,
  enrichKickoffFields,
} = require('./schedule');
const { syncResultsFromExternal, startResultsSyncScheduler } = require('./resultsSync');
const { attachOdds, buildRankMap } = require('./odds');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'fifaweb-sim-dev-secret';
const INITIAL_BALANCE = 1000;
const MIN_STAKE = 2;

app.use(cors());
app.use(express.json());

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期' });
  }
}

function wrap(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((e) => {
      console.error(e);
      res.status(500).json({ error: e.message || '服务器错误' });
    });
  };
}

app.post(
  '/api/auth/register',
  wrap(async (req, res) => {
    const { username, password } = req.body;
    if (!username?.trim() || !password || password.length < 4) {
      return res.status(400).json({ error: '用户名和密码至少4位' });
    }
    if (await store.findUserByName(username.trim())) {
      return res.status(409).json({ error: '用户名已存在' });
    }
    const hash = bcrypt.hashSync(password, 10);
    const user = await store.createUser(username.trim(), hash, INITIAL_BALANCE);
    await store.createTransaction({
      user_id: user.id,
      type: 'init',
      amount: INITIAL_BALANCE,
      balance_after: INITIAL_BALANCE,
      note: '开户赠送',
    });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, balance: user.balance } });
  })
);

app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    const { username, password } = req.body;
    const user = await store.findUserByName(username?.trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, balance: user.balance } });
  })
);

app.get(
  '/api/me',
  auth,
  wrap(async (req, res) => {
    await settlePendingBets();
    const user = await store.findUserById(req.user.id);
    res.json({ user: { id: user.id, username: user.username, balance: user.balance } });
  })
);

app.get(
  '/api/matches/today',
  auth,
  wrap(async (req, res) => {
    await settlePendingBets();
    const schedule = await loadSchedule();
    const todayMatches = await enrichMatches(schedule, true);
    const market = getMarketInfo();
    const openCount = todayMatches.filter((m) => m.marketOpen).length;
    res.json({ ...market, matches: todayMatches, count: openCount, total: todayMatches.length });
  })
);

app.get(
  '/api/matches',
  auth,
  wrap(async (req, res) => {
    await settlePendingBets();
    const schedule = await loadSchedule();
    const rankMap = buildRankMap(schedule.teams);
    const matches = sortByKickoff(
      schedule.matches.map((m) =>
        enrichKickoffFields({
          ...attachOdds(m, rankMap),
          marketOpen: isMarketOpen(m),
        })
      )
    );
    res.json({ matches });
  })
);

app.post(
  '/api/bets',
  auth,
  wrap(async (req, res) => {
    await settlePendingBets();
    const { matchNumber, betType, selection, stake } = req.body;
    if (!['wdl', 'handicap'].includes(betType)) {
      return res.status(400).json({ error: '无效玩法' });
    }
    if (!['home', 'draw', 'away'].includes(selection)) {
      return res.status(400).json({ error: '无效选项' });
    }
    const amount = Number(stake);
    if (!amount || amount < MIN_STAKE || amount % 1 !== 0) {
      return res.status(400).json({ error: `投注额须为不小于${MIN_STAKE}的整数梅罗` });
    }

    const schedule = await loadSchedule();
    const match = schedule.matches.find((m) => m.matchNumber === Number(matchNumber));
    if (!match) return res.status(404).json({ error: '比赛不存在' });
    const blockReason = getBetBlockReason(match, new Date());
    if (blockReason) return res.status(400).json({ error: blockReason });

    const rankMap = buildRankMap(schedule.teams);
    const enriched = attachOdds(match, rankMap);
    const oddsBlock = betType === 'wdl' ? enriched.odds.wdl : enriched.odds.handicap;
    const odds = oddsBlock[selection];
    const handicap = betType === 'handicap' ? enriched.odds.handicap.line : null;
    const potentialWin = Math.round(amount * odds * 100) / 100;

    const user = await store.findUserById(req.user.id);
    if (user.balance < amount) return res.status(400).json({ error: '梅罗余额不足' });

    const newBalance = await store.updateBalance(user.id, -amount);
    const bet = await store.createBet({
      user_id: user.id,
      match_number: match.matchNumber,
      bet_type: betType,
      selection,
      handicap,
      odds,
      stake: amount,
      potential_win: potentialWin,
    });
    await store.createTransaction({
      user_id: user.id,
      type: 'bet',
      amount: -amount,
      balance_after: newBalance,
      bet_id: bet.id,
      note: `投注第${match.matchNumber}场`,
    });

    res.json({ ok: true, betId: bet.id, balance: newBalance, potentialWin, odds });
  })
);

app.get(
  '/api/bets',
  auth,
  wrap(async (req, res) => {
    await settlePendingBets();
    const schedule = await loadSchedule();
    const matchMap = Object.fromEntries(schedule.matches.map((m) => [m.matchNumber, m]));
    const bets = (await store.getBetsByUser(req.user.id)).map((b) => ({
      ...b,
      match: matchMap[b.match_number] || null,
    }));
    res.json({ bets });
  })
);

app.get(
  '/api/transactions',
  auth,
  wrap(async (req, res) => {
    res.json({ transactions: await store.getTransactions(req.user.id) });
  })
);

app.get(
  '/api/leaderboard',
  auth,
  wrap(async (req, res) => {
    await settlePendingBets();
    const rankings = await store.getLeaderboard();
    res.json({ rankings });
  })
);

app.get(
  '/api/tournament',
  wrap(async (_req, res) => {
    const schedule = await loadSchedule();
    res.json({ tournament: schedule.tournament });
  })
);

const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(clientDist, 'index.html'), (err) => {
    if (err) res.status(404).end();
  });
});

async function start() {
  if (!process.env.DATABASE_URL) {
    console.error('缺少 DATABASE_URL，请配置 .env');
    process.exit(1);
  }
  await initSchema();
  try {
    const sync = await syncResultsFromExternal();
    console.log(
      `赛果同步: 更新 ${sync.updated} 场，结算 ${sync.settledBets} 注，外部已完赛 ${sync.externalFinished} 场`
    );
  } catch (error) {
    console.error('启动赛果同步失败:', error.message);
    await settlePendingBets();
  }
  startResultsSyncScheduler();
  app.listen(PORT, () => {
    console.log(`FIFAweb server http://localhost:${PORT} (Neon PostgreSQL)`);
  });
}

start().catch((e) => {
  console.error('启动失败:', e.message);
  process.exit(1);
});
