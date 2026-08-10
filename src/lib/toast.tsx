import { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CheckCircle2, XCircle, X, Bell } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  tone: 'success' | 'error' | 'info';
}

interface ArrivalBanner {
  id: number;
  title: string;
  body: string;
  onClick?: () => void;
}

interface ToastContextValue {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showInfo: (message: string) => void;
  showArrival: (opts: { title: string; body: string; onClick?: () => void }) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showSuccess: () => {},
  showError: () => {},
  showInfo: () => {},
  showArrival: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [arrival, setArrival] = useState<ArrivalBanner | null>(null);

  const push = useCallback((message: string, tone: Toast['tone']) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  const showSuccess = useCallback((message: string) => push(message, 'success'), [push]);
  const showError = useCallback((message: string) => push(message, 'error'), [push]);
  const showInfo = useCallback((message: string) => push(message, 'info'), [push]);

  const showArrival = useCallback((opts: { title: string; body: string; onClick?: () => void }) => {
    const id = Date.now() + Math.random();
    setArrival({ id, title: opts.title, body: opts.body, onClick: opts.onClick });
    setTimeout(() => setArrival((prev) => (prev?.id === id ? null : prev)), 12_000);
  }, []);

  return (
    <ToastContext.Provider value={{ showSuccess, showError, showInfo, showArrival }}>
      {children}

      {/* Top arrival banner — always visible in-app (OS banners are often blocked while focused). */}
      {arrival && (
        <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-md rounded-2xl shadow-2xl border border-white/20 bg-gradient-to-r from-brand to-brand-2 text-white px-4 py-3.5 flex items-start gap-3 nexus-arrival-banner">
            <button
              type="button"
              onClick={() => {
                const go = arrival.onClick;
                setArrival(null);
                go?.();
              }}
              className="flex items-start gap-3 min-w-0 flex-1 text-left"
            >
              <span className="mt-0.5 w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold leading-tight">{arrival.title}</span>
                <span className="block text-xs text-white/90 mt-0.5 leading-snug">{arrival.body}</span>
                <span className="block text-[11px] font-semibold text-white/80 mt-2">Tap to open</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setArrival(null)}
              className="shrink-0 p-1 rounded-full hover:bg-white/15"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4 opacity-80" />
            </button>
          </div>
        </div>
      )}

      <div className="fixed bottom-20 md:bottom-5 left-0 right-0 flex flex-col items-center gap-2 px-4 z-50 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm w-full ${
              t.tone === 'success'
                ? 'bg-ink text-white'
                : t.tone === 'error'
                  ? 'bg-danger text-white'
                  : 'bg-gradient-to-r from-brand to-brand-2 text-white'
            }`}
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : t.tone === 'error' ? (
              <XCircle className="w-4 h-4 shrink-0" />
            ) : (
              <Bell className="w-4 h-4 shrink-0" />
            )}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>
              <X className="w-3.5 h-3.5 opacity-70" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
