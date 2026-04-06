import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';

export default function VerifyPhonePage({ onSkip }) {
  const { user, verifyPhone } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyPhone(code);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await api.resendCode();
      setResent(true);
      setTimeout(() => setResent(false), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">the <span>middle</span> ground</div>
        <div className="auth-tagline">Meet halfway, no compromises</div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div style={{ fontSize: 48, textAlign: 'center', marginBottom: 8 }}>📱</div>
          <h2 className="auth-title" style={{ textAlign: 'center' }}>Verify your phone</h2>
          <p className="auth-sub" style={{ textAlign: 'center' }}>
            We sent a 6-digit code to <strong>{user?.phone}</strong>
          </p>

          {error && <div className="auth-error">{error}</div>}
          {resent && <div className="auth-success">Code resent!</div>}

          <div className="auth-field">
            <label>Verification Code</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              maxLength={6}
              required
              style={{ textAlign: 'center', fontSize: 24, letterSpacing: 8 }}
            />
          </div>

          <button type="submit" className="auth-btn" disabled={loading || code.length !== 6}>
            {loading ? 'Verifying…' : '✓ Verify'}
          </button>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button type="button" className="auth-btn-secondary" onClick={handleResend}>Resend Code</button>
            <button type="button" className="auth-btn-secondary" onClick={onSkip}>Skip for Now</button>
          </div>
        </form>
      </div>
    </div>
  );
}
