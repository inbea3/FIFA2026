import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import AppMotto from './AppMotto';

const FEATURES = ['胜平负 / 让球', '1000 梅罗开户', '模拟竞猜体验'];

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(username, password);
      else await register(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg-deco" aria-hidden>
        <span className="auth-orb auth-orb-1" />
        <span className="auth-orb auth-orb-2" />
        <span className="auth-ball">⚽</span>
      </div>

      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-brand">
          <div className="logo-icon auth-logo">梅罗</div>
          <h2>{mode === 'login' ? '欢迎回来' : '创建账户'}</h2>
          <p className="subtitle">
            2026 美加墨世界杯 · 模拟竞猜
          </p>
          <AppMotto variant="auth" />
        </div>

        <div className="auth-features">
          {FEATURES.map((f) => (
            <span key={f} className="auth-feature-pill">{f}</span>
          ))}
        </div>

        <form onSubmit={submit}>
          {error && <p className="error-msg">{error}</p>}
          <div className="form-group">
            <label>用户名</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={2}
              placeholder="至少 2 个字符"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={4}
              placeholder="至少 4 位"
            />
          </div>
          <button type="submit" className="btn-primary btn-block" disabled={loading}>
            {loading ? '处理中...' : mode === 'login' ? '登录竞猜' : '注册开户 · 赠 1000 梅罗'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? '还没有账户？' : '已有账户？'}
          <button type="button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? '立即注册' : '去登录'}
          </button>
        </p>

        <p className="auth-disclaimer">仅供个人模拟体验，非真实博彩</p>
      </motion.div>
    </div>
  );
}
