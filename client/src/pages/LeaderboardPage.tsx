import { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import PageHeader from '../components/PageHeader';
import LoadingBlock from '../components/LoadingBlock';
import EmptyState from '../components/EmptyState';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { LeaderboardEntry } from '../types';

const RANK_MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .leaderboard()
      .then((d) => setRankings(d.rankings ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : '加载失败'))
      .finally(() => setLoading(false));
  }, []);

  const myRank = useMemo(
    () => rankings.find((e) => e.id === user?.id),
    [rankings, user?.id]
  );

  const top3 = rankings.slice(0, 3);

  return (
    <Layout tab="leaderboard">
      <PageHeader
        title="资金排行榜"
        subtitle="按当前梅罗余额从高到低排名"
        badge={loading ? undefined : `${rankings.length} 位玩家`}
      />

      {!loading && myRank && (
        <div className="my-rank-banner">
          <span>我的排名</span>
          <strong>第 {myRank.rank} 名</strong>
          <span className="my-rank-balance">{myRank.balance.toFixed(0)} 梅罗</span>
        </div>
      )}

      {loading ? (
        <LoadingBlock label="加载排行榜..." />
      ) : error ? (
        <EmptyState icon="⚠️" title="排行榜加载失败" description={`${error}。若刚更新过代码，请重启 npm run dev`} />
      ) : rankings.length === 0 ? (
        <EmptyState icon="🏆" title="暂无用户数据" />
      ) : (
        <>
          {top3.length > 0 && (
            <div className="podium">
              {[top3[1], top3[0], top3[2]].filter(Boolean).map((entry) => {
                if (!entry) return null;
                const isMe = entry.id === user?.id;
                return (
                  <motion.div
                    key={entry.id}
                    className={`podium-item rank-${entry.rank}${isMe ? ' is-me' : ''}`}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: entry.rank * 0.1 }}
                  >
                    <div className="podium-medal">{RANK_MEDAL[entry.rank]}</div>
                    <div className="podium-name">
                      {entry.username}
                      {isMe && <span className="leaderboard-me-tag">我</span>}
                    </div>
                    <div className="podium-balance">{entry.balance.toFixed(0)}</div>
                    <div className="podium-unit">梅罗</div>
                    <div className="podium-bar" />
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="leaderboard">
            {rankings.map((entry, i) => {
              const isMe = entry.id === user?.id;
              return (
                <motion.div
                  key={entry.id}
                  className={`leaderboard-row${isMe ? ' is-me' : ''}${entry.rank <= 3 ? ` top-${entry.rank}` : ''}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <div className="leaderboard-rank">{entry.rank}</div>
                  <div className="leaderboard-user">
                    <span className="leaderboard-name">
                      {entry.username}
                      {isMe && <span className="leaderboard-me-tag">我</span>}
                    </span>
                  </div>
                  <div className="leaderboard-balance">
                    <span className="amount">{entry.balance.toFixed(0)}</span>
                    <span className="unit">梅罗</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </Layout>
  );
}
