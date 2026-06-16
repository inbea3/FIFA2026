import { motion, AnimatePresence } from 'framer-motion';
import type { BetSelection } from '../types';
import TeamLabel from './TeamLabel';

interface Props {
  selection: BetSelection | null;
  stake: number;
  onStakeChange: (v: number) => void;
  onSubmit: () => void;
  onClear: () => void;
  loading: boolean;
}

const QUICK_STAKES = [10, 50, 100, 200];

export default function BetSlip({ selection, stake, onStakeChange, onSubmit, onClear, loading }: Props) {
  const potential = selection ? Math.round(stake * selection.odds * 100) / 100 : 0;

  return (
    <AnimatePresence>
      {selection && (
        <motion.div
          className="bet-slip"
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
        >
          <div className="bet-slip-inner">
            <div className="bet-slip-info">
              <div className="bet-slip-type">
                {selection.betType === 'wdl' ? '胜平负' : `让球(${selection.match.odds.handicap.lineLabel})`}
              </div>
              <div className="bet-slip-match">
                <TeamLabel name={selection.match.homeTeam} nameZh={selection.match.homeTeamZh} />
                <span className="bet-slip-vs">vs</span>
                <TeamLabel name={selection.match.awayTeam} nameZh={selection.match.awayTeamZh} />
              </div>
              <div className="bet-slip-pick">
                选择 <strong>{selection.label}</strong> · 赔率 {selection.odds.toFixed(2)}
              </div>
            </div>

            <div className="bet-slip-controls">
              <div className="stake-block">
                <span className="stake-label">投注金额</span>
                <div className="stake-input">
                  <input
                    type="number"
                    min={2}
                    step={1}
                    value={stake}
                    onChange={(e) => onStakeChange(Math.max(2, parseInt(e.target.value) || 2))}
                  />
                  <span className="stake-unit">梅罗</span>
                </div>
                <div className="quick-stakes">
                  {QUICK_STAKES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`quick-stake-btn${stake === n ? ' active' : ''}`}
                      onClick={() => onStakeChange(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div className="potential-block">
                <span className="potential-label">可赢金额</span>
                <span className="potential-value">{potential}</span>
                <span className="potential-unit">梅罗</span>
              </div>
            </div>

            <div className="bet-slip-actions">
              <button type="button" className="btn-ghost" onClick={onClear}>
                取消
              </button>
              <button type="button" className="btn-primary" onClick={onSubmit} disabled={loading}>
                {loading ? '提交中...' : '确认投注'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
