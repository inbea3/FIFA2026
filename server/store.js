const { pool } = require('./db');

function rowToUser(row) {
  return {
    id: row.id,
    username: row.username,
    password_hash: row.password_hash,
    balance: parseFloat(row.balance),
    created_at: row.created_at,
  };
}

function rowToBet(row) {
  return {
    id: row.id,
    user_id: row.user_id,
    match_number: row.match_number,
    bet_type: row.bet_type,
    selection: row.selection,
    handicap: row.handicap != null ? parseFloat(row.handicap) : null,
    odds: parseFloat(row.odds),
    stake: parseFloat(row.stake),
    potential_win: parseFloat(row.potential_win),
    status: row.status,
    payout: row.payout != null ? parseFloat(row.payout) : null,
    created_at: row.created_at,
    settled_at: row.settled_at,
  };
}

async function findUserByName(username) {
  const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

async function findUserById(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] ? rowToUser(rows[0]) : null;
}

async function createUser(username, passwordHash, balance) {
  const { rows } = await pool.query(
    'INSERT INTO users (username, password_hash, balance) VALUES ($1, $2, $3) RETURNING *',
    [username, passwordHash, balance]
  );
  return rowToUser(rows[0]);
}

async function updateBalance(userId, delta) {
  const { rows } = await pool.query(
    'UPDATE users SET balance = ROUND((balance + $1)::numeric, 2) WHERE id = $2 RETURNING balance',
    [delta, userId]
  );
  if (!rows[0]) throw new Error('user not found');
  return parseFloat(rows[0].balance);
}

async function createBet(bet) {
  const { rows } = await pool.query(
    `INSERT INTO bets (user_id, match_number, bet_type, selection, handicap, odds, stake, potential_win)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [
      bet.user_id,
      bet.match_number,
      bet.bet_type,
      bet.selection,
      bet.handicap,
      bet.odds,
      bet.stake,
      bet.potential_win,
    ]
  );
  return rowToBet(rows[0]);
}

async function getBetsByUser(userId) {
  const { rows } = await pool.query(
    'SELECT * FROM bets WHERE user_id = $1 ORDER BY id DESC',
    [userId]
  );
  return rows.map(rowToBet);
}

async function getPendingBets() {
  const { rows } = await pool.query("SELECT * FROM bets WHERE status = 'pending'");
  return rows.map(rowToBet);
}

async function settleBet(id, status, payout) {
  await pool.query(
    "UPDATE bets SET status = $1, payout = $2, settled_at = NOW() WHERE id = $3",
    [status, payout, id]
  );
}

async function createTransaction(tx) {
  const { rows } = await pool.query(
    `INSERT INTO transactions (user_id, type, amount, balance_after, bet_id, note)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tx.user_id, tx.type, tx.amount, tx.balance_after, tx.bet_id ?? null, tx.note ?? null]
  );
  return rows[0];
}

async function getTransactions(userId, limit = 50) {
  const { rows } = await pool.query(
    'SELECT * FROM transactions WHERE user_id = $1 ORDER BY id DESC LIMIT $2',
    [userId, limit]
  );
  return rows;
}

async function getLeaderboard() {
  const { rows } = await pool.query(
    'SELECT id, username, balance FROM users ORDER BY balance DESC, id ASC'
  );
  return rows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    username: row.username,
    balance: parseFloat(row.balance),
  }));
}

module.exports = {
  findUserByName,
  findUserById,
  createUser,
  updateBalance,
  createBet,
  getBetsByUser,
  getPendingBets,
  settleBet,
  createTransaction,
  getTransactions,
  getLeaderboard,
};
