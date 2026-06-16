import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingBlock from '../components/LoadingBlock';
import EmptyState from '../components/EmptyState';
import TeamLabel from '../components/TeamLabel';
import { api } from '../api';
import type { Bet } from '../types';

const SEL_LABEL: Record<string, string> = { home: '胜/让胜', draw: '平/让平', away: '负/让负' };
const STATUS_LABEL: Record<string, string> = { pending: '待开奖', won: '已中奖', lost: '未中奖' };

export default function BetsPage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myBets().then((d) => setBets(d.bets)).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const pending = bets.filter((b) => b.status === 'pending').length;
    const won = bets.filter((b) => b.status === 'won').length;
    const profit = bets.reduce((sum, b) => sum + (b.payout || 0) - b.stake, 0);
    return { total: bets.length, pending, won, profit };
  }, [bets]);

  return (
    <Layout tab="bets">
      <PageHeader
        title="我的注单"
        subtitle="查看投注记录与结算状态"
        badge={loading ? undefined : `共 ${stats.total} 笔`}
      />

      {!loading && bets.length > 0 && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-value">{stats.pending}</span>
            <span className="stat-label">待开奖</span>
          </div>
          <div className="stat-card">
            <span className="stat-value stat-win">{stats.won}</span>
            <span className="stat-label">已中奖</span>
          </div>
          <div className="stat-card">
            <span className={`stat-value ${stats.profit >= 0 ? 'stat-win' : 'stat-loss'}`}>
              {stats.profit >= 0 ? '+' : ''}
              {stats.profit.toFixed(0)}
            </span>
            <span className="stat-label">净盈亏</span>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingBlock label="加载注单中..." />
      ) : bets.length === 0 ? (
        <EmptyState icon="🎫" title="暂无投注记录" description="去今日开盘页面选择赛事投注吧" />
      ) : (
        <div className="bet-list">
          {bets.map((b, i) => (
            <motion.div
              key={b.id}
              className="bet-item"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.2) }}
            >
              <div className="bet-item-left">
                <div className="bet-item-title">
                  <span className="bet-match-num">#{b.match_number}</span>
                  {b.match ? (
                    <>
                      <TeamLabel name={b.match.homeTeam} nameZh={b.match.homeTeamZh} />
                      <span className="bet-vs">vs</span>
                      <TeamLabel name={b.match.awayTeam} nameZh={b.match.awayTeamZh} />
                    </>
                  ) : (
                    '比赛信息不可用'
                  )}
                </div>
                <div className="bet-item-meta">
                  <span className="bet-tag">{b.bet_type === 'wdl' ? '胜平负' : `让球 ${b.handicap}`}</span>
                  <span>{SEL_LABEL[b.selection]}</span>
                  <span>赔率 {b.odds.toFixed(2)}</span>
                </div>
                <div className="bet-item-time">
                  {new Date(b.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
                </div>
              </div>
              <div className="bet-item-right">
                <div className="bet-stake-line">
                  <span className="bet-stake">{b.stake}</span>
                  <span className="bet-arrow">→</span>
                  <span className="bet-potential">{b.potential_win}</span>
                  <span className="bet-unit">梅罗</span>
                </div>
                <span className={`status-pill status-${b.status}`}>{STATUS_LABEL[b.status]}</span>
                {b.status === 'won' && b.payout != null && (
                  <div className="bet-payout">+{b.payout} 梅罗</div>
                )}
                {b.match?.status === 'finished' && (
                  <div className="bet-result">
                    赛果 {b.match.homeScore}:{b.match.awayScore}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </Layout>
  );
}
