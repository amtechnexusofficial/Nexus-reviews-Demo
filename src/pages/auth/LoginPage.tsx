import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { authApi } from '../../lib/api';
import { branding } from '../../config/branding';
import { useActiveLocation } from '../../lib/useLocation';

export default function LoginPage() {
  const navigate = useNavigate();
  const { setLocationId } = useActiveLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login({ email, password });
      authApi.setToken(res.token);
      if (res.locations?.[0]) setLocationId(res.locations[0].id);
      navigate('/dashboard');
    } catch {
      setError('Invalid email or password.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <div className="w-full max-w-sm glass rounded-3xl p-8">
        <h1 className="font-display text-2xl font-bold text-center mb-1 brand-gradient-text">{branding.productName}</h1>
        <p className="text-sm text-ink-soft text-center mb-8">Log in to your dashboard</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full border border-line rounded-lg p-3 text-sm focus:border-brand outline-none"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full border border-line rounded-lg p-3 text-sm focus:border-brand outline-none"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Log in
          </Button>
        </form>
        <p className="text-sm text-ink-soft text-center mt-3">
          <Link to="/forgot-password" className="text-brand font-medium">Forgot password?</Link>
        </p>
        <p className="text-sm text-ink-soft text-center mt-2">
          No account? <Link to="/signup" className="text-brand font-medium">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
