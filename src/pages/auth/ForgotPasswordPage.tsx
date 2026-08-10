import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { authApi } from '../../lib/api';
import { branding } from '../../config/branding';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [devNote, setDevNote] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.requestPasswordReset(email);
      setMessage(res.message);
      if (res.devNote) setDevNote(res.devNote);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5">
      <div className="w-full max-w-sm glass rounded-3xl p-8">
        <h1 className="font-display text-2xl font-bold text-center mb-1 brand-gradient-text">{branding.productName}</h1>
        <p className="text-sm text-ink-soft text-center mb-8">Reset your password</p>

        {message ? (
          <div className="text-center">
            <p className="text-sm text-success mb-2">{message}</p>
            {devNote && <p className="text-xs text-warning bg-amber-50 border border-amber-200 rounded-lg p-3">{devNote}</p>}
            <Link to="/login" className="text-sm text-brand font-medium block mt-4">Back to login</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className="w-full border border-line rounded-lg p-3 text-sm focus:border-brand outline-none"
            />
            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
            <p className="text-sm text-ink-soft text-center">
              <Link to="/login" className="text-brand font-medium">Back to login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
