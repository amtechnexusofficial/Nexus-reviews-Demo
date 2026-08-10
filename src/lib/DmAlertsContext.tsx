import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { chatKey } from './dmUnread';

type DmAlertsContextValue = {
  unreadKeys: Set<string>;
  unreadCount: number;
  setUnreadKeys: (keys: Set<string>) => void;
  markLocallyRead: (locationId: number, platform: string, chatId: string) => void;
};

const DmAlertsContext = createContext<DmAlertsContextValue>({
  unreadKeys: new Set(),
  unreadCount: 0,
  setUnreadKeys: () => {},
  markLocallyRead: () => {},
});

export function DmAlertsProvider({ children }: { children: ReactNode }) {
  const [unreadKeys, setUnreadKeysState] = useState<Set<string>>(() => new Set());

  const setUnreadKeys = useCallback((keys: Set<string>) => {
    setUnreadKeysState(new Set(keys));
  }, []);

  const markLocallyRead = useCallback((locationId: number, platform: string, chatId: string) => {
    const key = chatKey(locationId, platform, chatId);
    setUnreadKeysState((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      unreadKeys,
      unreadCount: unreadKeys.size,
      setUnreadKeys,
      markLocallyRead,
    }),
    [unreadKeys, setUnreadKeys, markLocallyRead]
  );

  return <DmAlertsContext.Provider value={value}>{children}</DmAlertsContext.Provider>;
}

export function useDmAlerts() {
  return useContext(DmAlertsContext);
}
