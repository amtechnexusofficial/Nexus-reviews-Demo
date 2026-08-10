import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { authApi } from '../../lib/api';
import { branding } from '../../config/branding';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await authApi.resetPassword({ email, token, newPassword });
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message.includes('400') ? 'This reset link is invalid or has expired.' : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  if (!token || !email) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-5">
        <p className="text-sm text-ink-soft">
          Invalid reset link. <Link to="/forgot-password" className="text-brand font-medium">Request a new one</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <div className="w-full max-w-sm glass rounded-3xl p-8">
        <h1 className="font-display text-2xl font-bold text-center mb-1 brand-gradient-text">{branding.productName}</h1>
        <p className="text-sm text-ink-soft text-center mb-8">Set a new password</p>

        {done ? (
          <p className="text-sm text-success text-center">Password updated — redirecting to login...</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 characters)"
              className="w-full border border-line rounded-lg p-3 text-sm focus:border-brand outline-none"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" loading={loading}>
              Update password
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
