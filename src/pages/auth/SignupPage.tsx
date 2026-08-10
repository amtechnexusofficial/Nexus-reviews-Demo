import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { authApi } from '../../lib/api';
import { branding } from '../../config/branding';
import { useActiveLocation } from '../../lib/useLocation';

export default function SignupPage() {
  const navigate = useNavigate();
  const { setLocationId } = useActiveLocation();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.signup({ businessName, email, password });
      authApi.setToken(res.token);
      setLocationId(res.location.id);
      navigate('/dashboard/settings');
    } catch (err: any) {
      setError(err.message.includes('409') ? 'An account with this email already exists.' : 'Something went wrong — try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <div className="w-full max-w-sm glass rounded-3xl p-8">
        <h1 className="font-display text-2xl font-bold text-center mb-1 brand-gradient-text">{branding.productName}</h1>
        <p className="text-sm text-ink-soft text-center mb-8">Create your account</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Business name"
            className="w-full border border-line rounded-lg p-3 text-sm focus:border-brand outline-none"
          />
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password (min 8 characters)"
            className="w-full border border-line rounded-lg p-3 text-sm focus:border-brand outline-none"
          />
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>
        <p className="text-sm text-ink-soft text-center mt-5">
          Already have an account? <Link to="/login" className="text-brand font-medium">Log in</Link>
        </p>
      </div>
    </div>
  );
}
