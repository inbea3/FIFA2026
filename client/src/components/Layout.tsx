import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppMotto from './AppMotto';

const TABS = [
  { to: '/', tab: 'today', icon: '⚡', label: '今日开盘' },
  { to: '/schedule', tab: 'schedule', icon: '📅', label: '全部赛程' },
  { to: '/bets', tab: 'bets', icon: '🎫', label: '我的注单' },
  { to: '/leaderboard', tab: 'leaderboard', icon: '🏆', label: '资金排行' },
] as const;

export default function Layout({
  children,
  tab,
}: {
  children: React.ReactNode;
  tab: 'today' | 'bets' | 'schedule' | 'leaderboard';
}) {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="header">
        <Link to="/" className="logo">
          <div className="logo-icon">梅罗</div>
          <div>
            <h1>梅罗竞猜</h1>
            <span>2026 美加墨世界杯 · 模拟</span>
          </div>
        </Link>
        <div className="header-actions">
          <div className="balance-pill">
            <span className="balance-label">余额</span>
            <span className="amount">{user?.balance.toFixed(0)}</span>
            <span className="balance-unit">梅罗</span>
          </div>
          <span className="user-chip">{user?.username}</span>
          <button type="button" className="btn-ghost btn-sm" onClick={logout}>
            退出
          </button>
        </div>
      </header>

      <nav className="nav-tabs">
        {TABS.map((t) => (
          <Link key={t.to} to={t.to} className={`nav-tab ${tab === t.tab ? 'active' : ''}`}>
            <span className="nav-tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </Link>
        ))}
      </nav>

      <AppMotto />

      <main className="page-content">{children}</main>
    </div>
  );
}
