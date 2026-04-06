import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage({ onSwitch }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">the <span>middle</span> ground</div>
        <div className="auth-tagline">Meet halfway, no compromises</div>

        <form onSubmit={handleSubmit} className="auth-form">
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-sub">Sign in to plan your next hangout</p>

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Signing in…' : '🎯 Sign In'}
          </button>
        </form>

        <div className="auth-switch">
          Don't have an account?{' '}
          <button onClick={onSwitch} className="auth-link">Create one</button>
        </div>
      </div>
    </div>
  );
}
