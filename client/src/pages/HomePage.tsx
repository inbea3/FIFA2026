import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Layout from '../components/Layout';
import MatchCard from '../components/MatchCard';
import BetSlip from '../components/BetSlip';
import PageHeader from '../components/PageHeader';
import LoadingBlock from '../components/LoadingBlock';
import EmptyState from '../components/EmptyState';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import type { Match, BetSelection } from '../types';

export default function HomePage() {
  const { refresh } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [openCount, setOpenCount] = useState(0);
  const [marketLabel, setMarketLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [selection, setSelection] = useState<BetSelection | null>(null);
  const [stake, setStake] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.todayMatches();
      setMatches(data.matches);
      setOpenCount(data.count);
      setMarketLabel(data.label || data.salesDate);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submitBet = async () => {
    if (!selection) return;
    setSubmitting(true);
    setMsg('');
    try {
      await api.placeBet({
        matchNumber: selection.match.matchNumber,
        betType: selection.betType,
        selection: selection.selection,
        stake,
      });
      setMsg('投注成功！');
      setSelection(null);
      await refresh();
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '投注失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout tab="today">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <PageHeader
          title="今日开盘"
          subtitle={marketLabel || '竞彩销售日：当日场次 + 次日凌晨/上午场（北京时间）'}
          badge={loading ? undefined : `${openCount} 场可投`}
        />

        {msg && (
          <div className={`toast ${msg.includes('成功') ? 'toast-success' : 'toast-error'}`}>{msg}</div>
        )}

        {loading ? (
          <LoadingBlock label="加载赛事中..." />
        ) : matches.length === 0 ? (
          <EmptyState
            icon="🌙"
            title="今日暂无开盘赛事"
            description="竞彩每日开盘：当日剩余场次 + 次日凌晨/上午场（北京时间）"
          />
        ) : (
          <div className="match-list">
            {matches.map((m, i) => (
              <MatchCard key={m.matchNumber} match={m} selected={selection} onSelect={setSelection} index={i} />
            ))}
          </div>
        )}
      </motion.div>

      <BetSlip
        selection={selection}
        stake={stake}
        onStakeChange={setStake}
        onSubmit={submitBet}
        onClear={() => setSelection(null)}
        loading={submitting}
      />
    </Layout>
  );
}
