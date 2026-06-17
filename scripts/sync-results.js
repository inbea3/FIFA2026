#!/usr/bin/env node
/** 从外部数据源拉取赛果，更新 matches 表（保留 users / bets）并触发结算 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { pool, initSchema } = require('../server/db');
const { syncResultsFromExternal } = require('../server/resultsSync');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('缺少 DATABASE_URL，请配置 .env');
    process.exit(1);
  }

  await initSchema();
  const result = await syncResultsFromExternal();

  console.log('赛果同步完成:');
  console.log(`  外部已完赛场次: ${result.externalFinished}`);
  console.log(`  本次更新: ${result.updated} 场`);
  if (result.updatedMatchNumbers.length) {
    console.log(`  更新场次: ${result.updatedMatchNumbers.join(', ')}`);
  }
  console.log(`  未变化: ${result.unchanged} 场`);
  console.log(`  暂无外部赛果: ${result.noExternal} 场`);
  console.log(`  本次结算注单: ${result.settledBets} 笔`);
  console.log(`  仍待开奖: ${result.pendingBets} 笔`);
}

main()
  .catch((error) => {
    console.error('同步失败:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
