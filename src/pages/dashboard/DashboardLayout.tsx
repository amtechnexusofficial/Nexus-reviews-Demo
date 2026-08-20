import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Inbox,
  QrCode,
  ShieldAlert,
  Settings,
  Sparkles,
  Users,
  Send,
  UserCircle2,
  Megaphone,
  LogOut,
  MessagesSquare,
  Bot,
  MessageSquareWarning,
  ShieldCheck,
  Star,
  Share2,
  Building2,
  Link2,
  Newspaper,
} from 'lucide-react';
import { branding } from '../../config/branding';
import { useActiveLocation } from '../../lib/useLocation';
import { authApi } from '../../lib/api';
import { useArrivalWatcher } from '../../lib/useArrivalWatcher';
import { DmAlertsProvider, useDmAlerts } from '../../lib/DmAlertsContext';
import { ensureWebPushSubscription } from '../../lib/webPush';

// ---------------- Category model — same structure drives BOTH desktop
// (icon rail + panel) and mobile (bottom nav + sub-tabs). One source of
// truth, two different controls depending on screen size. ----------------
const CATEGORIES = [
  {
    key: 'reviews',
    label: 'Reviews',
    icon: Star,
    pages: [
      { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/dashboard/inbox', label: 'Inbox', icon: Inbox },
      { to: '/dashboard/kiosk-reviews', label: 'Kiosk Reviews', icon: QrCode },
      { to: '/dashboard/screening', label: 'Screening', icon: ShieldAlert },
      { to: '/dashboard/requests', label: 'Requests', icon: Send },
    ],
  },
  {
    key: 'social',
    label: 'Social & DMs',
    icon: Share2,
    pages: [
      { to: '/dashboard/connections', label: 'Connections', icon: Link2 },
      { to: '/dashboard/dm-inbox', label: 'DM Inbox', icon: MessagesSquare },
      { to: '/dashboard/posts', label: 'Posts', icon: Newspaper },
      { to: '/dashboard/content', label: 'Create Post', icon: Megaphone },
    ],
  },
  {
    key: 'ai',
    label: 'AI Tools',
    icon: Bot,
    pages: [{ to: '/dashboard/insights', label: 'Insights', icon: Sparkles }],
  },
  {
    key: 'business',
    label: 'Business',
    icon: Building2,
    pages: [
      { to: '/dashboard/feedback-inbox', label: 'Feedback', icon: MessageSquareWarning },
      { to: '/dashboard/team', label: 'Team', icon: UserCircle2 },
      { to: '/dashboard/competitors', label: 'Competitors', icon: Users },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: Settings,
    pages: [{ to: '/dashboard/settings', label: 'Settings', icon: Settings, end: true }],
  },
];

function findActiveCategory(pathname: string) {
  return (
    CATEGORIES.find((cat) => cat.pages.some((p) => (p.end ? pathname === p.to : pathname.startsWith(p.to)))) ||
    CATEGORIES[0]
  );
}

function DashboardShell() {
  const { locationId, setLocationId, locations } = useActiveLocation();
  const navigate = useNavigate();
  const location = useLocation();
  const { unreadCount } = useDmAlerts();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const [activeCategoryKey, setActiveCategoryKey] = useState(findActiveCategory(location.pathname).key);

  useArrivalWatcher(locationId);

  useEffect(() => {
    // Subscribe this browser for true OS push (works when tab/app is elsewhere).
    // Requires a user gesture on some browsers — also retry on first pointerdown.
    ensureWebPushSubscription().catch(() => {});
    const onPointer = () => {
      ensureWebPushSubscription().catch(() => {});
    };
    document.addEventListener('pointerdown', onPointer, { once: true });
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [locationId]);

  useEffect(() => {
    setActiveCategoryKey(findActiveCategory(location.pathname).key);
  }, [location.pathname]);

  useEffect(() => {
    setImpersonating(authApi.impersonatingName());
    authApi.me().then((res) => setIsPlatformAdmin(res.isPlatformAdmin)).catch(() => {});
  }, []);

  const activeCategory = CATEGORIES.find((c) => c.key === activeCategoryKey) || CATEGORIES[0];
  const socialHasUnread = unreadCount > 0;

  function logout() {
    authApi.logout();
    navigate('/login');
  }

  function returnToAdmin() {
    authApi.endImpersonation();
    navigate('/admin');
    window.location.reload();
  }

  function selectCategory(key: string) {
    setActiveCategoryKey(key);
    const cat = CATEGORIES.find((c) => c.key === key);
    if (cat) navigate(cat.pages[0].to);
  }

  function pageHasUnread(to: string) {
    if (to !== '/dashboard/dm-inbox' || !locationId) return false;
    return unreadCount > 0;
  }

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      {impersonating && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm px-4 py-2 flex items-center justify-between shadow-lg">
          <span>Viewing as <strong>{impersonating}</strong> (admin session)</span>
          <button onClick={returnToAdmin} className="underline font-medium">Return to Admin</button>
        </div>
      )}

      {/* ============ DESKTOP: icon rail + contextual panel ============ */}
      <aside className={`hidden md:flex glass rounded-3xl m-3 flex-col items-center py-4 gap-1.5 w-[68px] shrink-0 ${impersonating ? 'mt-12' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand to-brand-2 text-white flex items-center justify-center font-display font-bold text-sm mb-3">
          {branding.productName.charAt(0)}
        </div>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategoryKey(cat.key)}
            title={cat.label}
            className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition-all ${
              activeCategoryKey === cat.key
                ? 'bg-gradient-to-br from-brand to-brand-2 text-white shadow-lg shadow-brand/30'
                : 'text-ink-soft hover:bg-white/60'
            }`}
          >
            <cat.icon className="w-5 h-5" />
            {cat.key === 'social' && socialHasUnread && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
          </button>
        ))}
        <div className="flex-1" />
        {isPlatformAdmin && !impersonating && (
          <button
            onClick={() => navigate('/admin')}
            title="Admin Console"
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-ink-soft hover:bg-white/60"
          >
            <ShieldCheck className="w-5 h-5" />
          </button>
        )}
        <button onClick={logout} title="Log out" className="w-11 h-11 rounded-2xl flex items-center justify-center text-ink-soft hover:bg-white/60">
          <LogOut className="w-5 h-5" />
        </button>
      </aside>

      <aside className={`hidden md:flex glass rounded-3xl my-3 flex-col w-52 shrink-0 ${impersonating ? 'mt-12' : ''}`}>
        <div className="px-4 pt-5 pb-3">
          <div className="font-display font-bold text-base truncate">{activeCategory.label}</div>
        </div>

        {locations.length > 1 && activeCategory.key === 'reviews' && (
          <div className="px-3 pb-3">
            <select
              value={locationId ?? ''}
              onChange={(e) => setLocationId(Number(e.target.value))}
              className="w-full text-xs border border-white/60 bg-white/50 rounded-xl px-2 py-1.5 focus:border-brand outline-none"
            >
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.address || `Location #${loc.id}`}</option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex-1 px-3 pb-4 space-y-1">
          {activeCategory.pages.map((page) => (
            <NavLink
              key={page.to}
              to={page.to}
              end={page.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium transition-all ${
                  isActive ? 'bg-gradient-to-r from-brand/15 to-brand-2/15 text-brand' : 'text-ink-soft hover:bg-white/50'
                }`
              }
            >
              <page.icon className="w-4 h-4" />
              <span className="flex-1 truncate">{page.label}</span>
              {pageHasUnread(page.to) && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Unread messages" />
              )}
            </NavLink>
          ))}
        </nav>

        {!locationId && (
          <div className="mx-3 mb-3 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] text-warning">
            No business selected — set one up in Settings.
          </div>
        )}
      </aside>

      {/* ============ MOBILE: top bar + sub-tabs + bottom category nav ============ */}
      <header className={`md:hidden h-16 flex items-center justify-between px-4 glass m-3 rounded-2xl sticky top-3 z-10 ${impersonating ? 'mt-12' : ''}`}>
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.productName} className="h-6" />
        ) : (
          <span className="font-display font-bold brand-gradient-text truncate">{branding.productName}</span>
        )}
        <button onClick={logout} className="text-ink-soft"><LogOut className="w-5 h-5" /></button>
      </header>

      {activeCategory.pages.length > 1 && (
        <div className="md:hidden flex gap-2 overflow-x-auto px-4 pb-1 -mt-1">
          {activeCategory.pages.map((page) => (
            <NavLink
              key={page.to}
              to={page.to}
              end={page.end}
              className={({ isActive }) =>
                `relative whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium glass ${
                  isActive ? 'bg-gradient-to-r from-brand to-brand-2 text-white' : 'text-ink-soft'
                }`
              }
            >
              {page.label}
              {pageHasUnread(page.to) && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </NavLink>
          ))}
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-28 md:pb-3 md:pr-3 md:pt-3">
        <Outlet />
      </main>

      <nav className="md:hidden fixed bottom-4 left-4 right-4 glass rounded-3xl flex items-stretch p-1.5 z-10">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => selectCategory(cat.key)}
            className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2 rounded-2xl text-[10px] font-medium transition-all ${
              activeCategoryKey === cat.key ? 'text-brand bg-gradient-to-r from-brand/10 to-brand-2/10' : 'text-ink-soft'
            }`}
          >
            <cat.icon className="w-5 h-5" />
            {cat.label}
            {cat.key === 'social' && socialHasUnread && (
              <span className="absolute top-1.5 right-[calc(50%-18px)] w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function DashboardLayout() {
  return (
    <DmAlertsProvider>
      <DashboardShell />
    </DmAlertsProvider>
  );
}
