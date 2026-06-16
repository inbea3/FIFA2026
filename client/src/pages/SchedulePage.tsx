import { useEffect, useState, useMemo } from 'react';
import Layout from '../components/Layout';
import MatchCard from '../components/MatchCard';
import PageHeader from '../components/PageHeader';
import LoadingBlock from '../components/LoadingBlock';
import { api } from '../api';
import type { Match } from '../types';

function kickoffMs(m: Match) {
  return m.kickoffCnMs ?? new Date(m.kickoffUtc).getTime();
}

function sortByKickoff(list: Match[]) {
  return [...list].sort((a, b) => kickoffMs(a) - kickoffMs(b));
}

function formatDateLabel(date: string) {
  const d = new Date(date + 'T12:00:00');
  const weekday = d.toLocaleDateString('zh-CN', { weekday: 'long' });
  return `${date} · ${weekday}`;
}

export default function SchedulePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.allMatches().then((d) => setMatches(d.matches)).finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const sorted = sortByKickoff(matches);
    const map: Record<string, Match[]> = {};
    for (const m of sorted) {
      const key = m.kickoffCnDate;
      if (!key) continue;
      (map[key] ||= []).push(m);
    }
    return map;
  }, [matches]);

  const sortedDates = Object.keys(grouped).sort();
  const finished = matches.filter((m) => m.status === 'finished').length;

  return (
    <Layout tab="schedule">
      <PageHeader
        title="全部赛程"
        subtitle="按北京时间分组排列 · 小组赛 72 场"
        badge={`${finished}/${matches.length} 已完赛`}
      />

      {loading ? (
        <LoadingBlock label="加载赛程中..." />
      ) : (
        sortedDates.map((date) => (
          <section key={date} className="schedule-day">
            <div className="schedule-day-header">
              <h3 className="schedule-day-title">{formatDateLabel(date)}</h3>
              <span className="schedule-day-count">{grouped[date].length} 场</span>
            </div>
            <div className="match-list">
              {grouped[date].map((m, i) => (
                <MatchCard
                  key={m.matchNumber}
                  match={m}
                  selected={null}
                  onSelect={() => {}}
                  index={i}
                  compact={m.status === 'finished'}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </Layout>
  );
}
