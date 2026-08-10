import { Navigate } from 'react-router-dom';
import { authApi } from '../lib/api';
import { ReactNode } from 'react';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  if (!authApi.isLoggedIn()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
