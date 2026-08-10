import { useEffect, useState, ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { authApi } from '../lib/api';

export default function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    if (!authApi.isLoggedIn()) {
      setStatus('denied');
      return;
    }
    authApi
      .me()
      .then((res) => setStatus(res.isPlatformAdmin ? 'allowed' : 'denied'))
      .catch(() => setStatus('denied'));
  }, []);

  if (status === 'checking') return <div className="p-8 text-sm text-ink-soft">Loading...</div>;
  if (status === 'denied') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
