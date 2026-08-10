import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Building2, ScrollText, ArrowLeft, LogOut } from 'lucide-react';
import { authApi } from '../../lib/api';
import { branding } from '../../config/branding';

export default function AdminLayout() {
  const navigate = useNavigate();

  function logout() {
    authApi.logout();
    navigate('/login');
  }

  return (
    <div className="min-h-dvh flex flex-col md:flex-row bg-paper">
      <aside className="hidden md:flex md:flex-col w-60 border-r border-line bg-ink shrink-0">
        <div className="h-16 flex items-center px-5 border-b border-white/10">
          <span className="font-display font-semibold text-lg text-white">{branding.productName} Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavLink
            to="/admin"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'
              }`
            }
          >
            <Building2 className="w-4.5 h-4.5" /> Businesses
          </NavLink>
          <NavLink
            to="/admin/audit-log"
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'
              }`
            }
          >
            <ScrollText className="w-4.5 h-4.5" /> Audit Log
          </NavLink>
        </nav>
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-3 px-3 py-2.5 mx-3 mb-2 rounded-lg text-sm font-medium text-white/60 hover:bg-white/5"
        >
          <ArrowLeft className="w-4.5 h-4.5" /> My Dashboard
        </button>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 mx-3 mb-4 rounded-lg text-sm font-medium text-white/60 hover:bg-white/5"
        >
          <LogOut className="w-4.5 h-4.5" /> Log out
        </button>
      </aside>

      <header className="md:hidden h-14 flex items-center justify-between px-4 bg-ink text-white sticky top-0 z-10">
        <span className="font-display font-semibold">Admin</span>
        <button onClick={() => navigate('/dashboard')} className="text-xs text-white/70">My Dashboard</button>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
