import { motion } from 'framer-motion';
import type { Match } from '../types';
import type { BetSelection } from '../types';
import TeamLabel from './TeamLabel';

interface Props {
  match: Match;
  selected: BetSelection | null;
  onSelect: (sel: BetSelection | null) => void;
  index?: number;
  compact?: boolean;
}

function OddsButtons({
  title,
  line,
  labels,
  odds,
  betType,
  match,
  selected,
  onSelect,
}: {
  title: string;
  line?: string;
  labels: Record<string, string>;
  odds: { home: number; draw: number; away: number };
  betType: 'wdl' | 'handicap';
  match: Match;
  selected: BetSelection | null;
  onSelect: (sel: BetSelection | null) => void;
}) {
  const keys = ['home', 'draw', 'away'] as const;

  return (
    <div className="odds-section">
      <div className="odds-title">
        {title}
        {line && <span className="odds-line">让球 {line}</span>}
      </div>
      <div className="odds-row">
        {keys.map((key) => {
          const isSelected =
            selected?.match.matchNumber === match.matchNumber &&
            selected.betType === betType &&
            selected.selection === key;
          return (
            <button
              key={key}
              type="button"
              className={`odds-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => {
                if (isSelected) onSelect(null);
                else
                  onSelect({
                    match,
                    betType,
                    selection: key,
                    odds: odds[key],
                    label: labels[key],
                  });
              }}
            >
              <span className="label">{labels[key]}</span>
              <span className="value">{odds[key].toFixed(2)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function statusMeta(match: Match) {
  if (match.status === 'finished') return { label: '已完赛', className: 'status-done' };
  if (match.status === 'scheduled' && match.marketOpen !== false) {
    return { label: '可投注', className: 'status-open' };
  }
  if (match.status === 'scheduled') return { label: '已封盘', className: 'status-closed' };
  return { label: '已封盘', className: 'status-closed' };
}

export default function MatchCard({ match, selected, onSelect, index = 0, compact = false }: Props) {
  const kickoff = match.kickoffCnTime || new Date(match.kickoffUtc).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const canBet = match.status === 'scheduled' && match.marketOpen !== false;
  const status = statusMeta(match);
  const closedMsg =
    match.status !== 'scheduled' ? '比赛已开始，已封盘' : '开赛前1小时已封盘，停止投注';

  return (
    <motion.div
      className={`match-card${compact ? ' match-card-compact' : ''}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
    >
      <div className="match-header">
        <div className="match-meta">
          <span className="match-num">#{match.matchNumber}</span>
          <span className="match-group">{match.group}组</span>
          <span className="match-day">{match.matchdayZh}</span>
        </div>
        <div className="match-header-right">
          <span className={`match-status ${status.className}`}>{status.label}</span>
          <span className="match-kickoff">
            {canBet && <span className="pulse-dot" />}
            {kickoff}
          </span>
        </div>
      </div>

      <div className="match-teams">
        <div className="team home">
          <TeamLabel name={match.homeTeam} nameZh={match.homeTeamZh} align="right" />
        </div>

        {match.status === 'finished' ? (
          <div className="score-block">
            <span className="score-num">{match.homeScore}</span>
            <span className="score-sep">:</span>
            <span className="score-num">{match.awayScore}</span>
          </div>
        ) : (
          <div className="vs-badge">VS</div>
        )}

        <div className="team away">
          <TeamLabel name={match.awayTeam} nameZh={match.awayTeamZh} align="left" />
        </div>
      </div>

      {!compact && match.hostCityZh && (
        <div className="match-venue">
          <span>📍</span>
          <span>{match.hostCityZh}</span>
          <span className="match-venue-sep">·</span>
          <span>{match.stadium}</span>
        </div>
      )}

      {!compact && match.status === 'finished' ? null : canBet ? (
        <>
          <OddsButtons
            title="胜平负"
            labels={match.odds.wdl.labels}
            odds={match.odds.wdl}
            betType="wdl"
            match={match}
            selected={selected}
            onSelect={onSelect}
          />
          <OddsButtons
            title="让球胜平负"
            line={match.odds.handicap.lineLabel}
            labels={match.odds.handicap.labels}
            odds={match.odds.handicap}
            betType="handicap"
            match={match}
            selected={selected}
            onSelect={onSelect}
          />
        </>
      ) : !compact && match.status !== 'finished' ? (
        <div className="match-closed">{closedMsg}</div>
      ) : null}
    </motion.div>
  );
}
