import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { dmsApi, reviewsApi } from './api';
import {
  announceArrival,
  ensureNotificationPermission,
  unlockAlertAudio,
} from './arrivalAlerts';
import { useToast } from './toast';
import { useDmAlerts } from './DmAlertsContext';
import {
  chatActivityAt,
  chatKey,
  ensureChatBaselined,
  getChatReadAt,
  isChatUnread,
  markChatAlerted,
  shouldAlertForChat,
} from './dmUnread';

const POLL_MS = 8_000;

/**
 * While the dashboard is open, poll for new Google reviews and DM activity.
 * Unread dots and alert watermarks are persisted separately in localStorage so
 * a first poll after refresh can still ding for truly new unread mail.
 */
export function useArrivalWatcher(locationId: number | null) {
  const navigate = useNavigate();
  const { showArrival } = useToast();
  const { setUnreadKeys } = useDmAlerts();

  const reviewIdsRef = useRef<Set<number> | null>(null);
  const platformsRef = useRef<string[]>([]);
  const inFlightRef = useRef(false);

  useEffect(() => {
    reviewIdsRef.current = null;
    platformsRef.current = [];
    setUnreadKeys(new Set());
  }, [locationId, setUnreadKeys]);

  useEffect(() => {
    if (!locationId) return;

    const unlock = () => {
      unlockAlertAudio();
      ensureNotificationPermission();
    };
    document.addEventListener('pointerdown', unlock, { once: true });
    ensureNotificationPermission();

    let cancelled = false;

    async function loadPlatforms() {
      try {
        const { platforms } = await dmsApi.platforms(locationId!);
        platformsRef.current = (platforms || []).map((p) => p.platform).filter(Boolean);
      } catch {
        platformsRef.current = [];
      }
    }

    async function poll() {
      if (cancelled || inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        try {
          const { reviews } = await reviewsApi.list(locationId!);
          const ids = new Set(reviews.map((r) => r.id));
          if (reviewIdsRef.current === null) {
            reviewIdsRef.current = ids;
          } else {
            const newcomers = reviews.filter((r) => !reviewIdsRef.current!.has(r.id));
            reviewIdsRef.current = ids;
            if (newcomers.length > 0) {
              const newest = newcomers.sort(
                (a, b) => +new Date(b.reviewCreatedAt) - +new Date(a.reviewCreatedAt)
              )[0];
              const title =
                newcomers.length === 1 ? 'New Google review' : `${newcomers.length} new Google reviews`;
              const body =
                newcomers.length === 1
                  ? `${newest.rating}★ from ${newest.authorName || 'a customer'}`
                  : `Latest: ${newest.rating}★ from ${newest.authorName || 'a customer'}`;
              const go = () => navigate('/dashboard/inbox');
              await announceArrival({ title, body, onClick: go, url: '/dashboard/inbox' });
              showArrival({ title, body, onClick: go });
            }
          }
        } catch {
          // Continue to DMs.
        }

        if (platformsRef.current.length === 0) {
          await loadPlatforms();
        }

        const unread = new Set<string>();
        const newlyArrived: {
          name: string;
          platform: string;
          chatId: string;
          activity: string;
        }[] = [];

        for (const platform of platformsRef.current) {
          try {
            const { chats } = await dmsApi.chats(locationId!, platform);
            for (const chat of chats || []) {
              const activity = chatActivityAt(chat);
              if (!activity) continue;
              const key = chatKey(locationId!, platform, chat.id);

              if (!getChatReadAt(locationId!, platform, chat.id)) {
                // Brand-new chat to this browser: silent baseline (no ding for history).
                ensureChatBaselined(locationId!, platform, chat.id, activity);
                continue;
              }

              if (isChatUnread(locationId!, platform, chat)) {
                unread.add(key);
              }

              if (shouldAlertForChat(locationId!, platform, chat)) {
                newlyArrived.push({
                  name: chat.participant_name || chat.participant_username || 'Customer',
                  platform,
                  chatId: chat.id,
                  activity,
                });
              }
            }
          } catch {
            // Skip a failing platform this tick.
          }
        }

        if (!cancelled) setUnreadKeys(unread);

        if (newlyArrived.length > 0) {
          for (const item of newlyArrived) {
            markChatAlerted(locationId!, item.platform, item.chatId, item.activity);
          }

          const sample = newlyArrived[0];
          const title =
            newlyArrived.length === 1 ? 'New direct message' : `${newlyArrived.length} new direct messages`;
          const body =
            newlyArrived.length === 1
              ? `From ${sample.name} on ${sample.platform}`
              : `Latest from ${sample.name} on ${sample.platform}`;
          const go = () => navigate('/dashboard/dm-inbox');
          await announceArrival({ title, body, onClick: go, url: '/dashboard/dm-inbox' });
          showArrival({ title, body, onClick: go });
        }
      } finally {
        inFlightRef.current = false;
      }
    }

    loadPlatforms().then(() => {
      if (!cancelled) poll();
    });

    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('pointerdown', unlock);
    };
  }, [locationId, navigate, showArrival, setUnreadKeys]);
}
