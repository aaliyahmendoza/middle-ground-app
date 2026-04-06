import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage({ onSwitch, onNeedVerify }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await register(name, email, password, phone || undefined);
      if (data.needsVerification && phone) {
        onNeedVerify?.();
      }
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
          <h2 className="auth-title">Create your account</h2>
          <p className="auth-sub">Start planning hangouts with friends</p>

          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required />
          </div>

          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>

          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 6 characters" required minLength={6} />
          </div>

          <div className="auth-field">
            <label>Phone Number <span className="optional">(optional — for SMS verification & sharing)</span></label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 (555) 123-4567" />
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
            {loading ? 'Creating account…' : '🚀 Create Account'}
          </button>
        </form>

        <div className="auth-switch">
          Already have an account?{' '}
          <button onClick={onSwitch} className="auth-link">Sign in</button>
        </div>
      </div>
    </div>
  );
}
