# 梅罗竞猜 · 2026 世界杯模拟

基于 Neon PostgreSQL 的足球竞猜模拟网站，仅供个人娱乐体验。

## 功能

- **胜平负** / **让球胜平负** 竞猜（算法生成赔率）
- **今日开盘**：当日场次 + 次日凌晨/上午场（北京时间）
- **全部赛程**：按北京时间分组展示
- **我的注单**：投注记录与结算状态
- **资金排行**：全用户梅罗余额排名
- **梅罗账户**：注册赠送 1000 梅罗，多用户独立账户

## 技术栈

- 前端：React + TypeScript + Vite + Framer Motion
- 后端：Node.js + Express
- 数据库：Neon PostgreSQL

## 目录结构

```
FIFAweb/
├── client/              # 前端（Vite + React）
│   └── src/
├── server/              # 后端 API
│   ├── index.js         # 路由入口
│   ├── db.js            # 数据库连接与建表
│   ├── store.js         # 用户/注单存储
│   ├── schedule.js      # 赛程、开盘、结算
│   └── odds.js          # 赔率生成
├── data/
│   └── schedule.json    # 赛程数据源（72 场小组赛）
├── scripts/
│   └── seed-db.js       # 导入赛程到数据库
├── .env.example
└── package.json
```

## 快速开始

### 1. 环境配置

复制 `.env.example` 为 `.env`，填入 Neon 连接串：

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/neondb?sslmode=require
JWT_SECRET=your-secret
PORT=3001
```

### 2. 安装依赖

```bash
npm install
cd client && npm install && cd ..
```

### 3. 初始化数据库

```bash
npm run db:seed
```

> 会清空已有用户与注单，重新导入赛程数据。

### 4. 启动开发环境

```bash
npm run dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3001

### 5. 生产部署

```bash
npm run build
npm start
```

## 数据表

| 表 | 说明 |
|---|---|
| `tournaments` | 赛事元信息 |
| `teams` | 48 支球队 |
| `venues` | 16 座球场 |
| `matches` | 72 场小组赛 |
| `users` | 用户账户 |
| `bets` | 投注记录 |
| `transactions` | 资金流水 |

修改 `data/schedule.json` 后重新导入：`npm run db:seed`

## 免责声明

本项目仅供个人模拟体验，非真实博彩，请勿用于任何商业或违法用途。
