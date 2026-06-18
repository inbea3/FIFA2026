#!/usr/bin/env node
/** 手动从体彩官网同步赔率到数据库 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { initSchema } = require('../server/db');
const { syncOddsFromSporttery } = require('../server/oddsSync');
const { pool } = require('../server/db');

async function main() {
  await initSchema();
  const result = await syncOddsFromSporttery();
  console.log(
    `体彩赔率同步完成: 更新 ${result.updated} 场，跳过 ${result.skipped} 场，未匹配 ${result.noExternal} 场，体彩在售 ${result.externalTotal} 场`
  );
  if (result.updatedMatchNumbers.length) {
    console.log('已更新场次:', result.updatedMatchNumbers.join(', '));
  }
  await pool.end();
}

main().catch((e) => {
  console.error('同步失败:', e.message);
  process.exit(1);
});
