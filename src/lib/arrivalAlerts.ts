// Shared alert helpers for new reviews / DMs / private feedback.
// Uses Web Audio (no asset file) + browser Notification API / service worker.

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AudioCtx();
  }
  return sharedCtx;
}

/** Call from a click/tap so the browser allows sound later without another gesture. */
export function unlockAlertAudio() {
  try {
    const ctx = getAudioContext();
    if (ctx?.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  } catch {
    // ignore
  }
}

export async function playAlertTone() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    [880, 660, 880].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.25;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.22);
    });
  } catch {
    // Web Audio unavailable/blocked — visual banner still works.
  }
}

/** Ask once for OS notification permission (no-op if unsupported or already decided). */
export function ensureNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

/**
 * Show a system notification. Prefer the service worker path — it is more
 * reliable when the tab is backgrounded. Always attempt (even if focused);
 * the OS may still suppress banners while the window is frontmost.
 */
export async function showBrowserNotification(
  title: string,
  body: string,
  opts?: { onClick?: () => void; url?: string }
) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const url = opts?.url || '/dashboard';
  const options: NotificationOptions = {
    body,
    silent: true, // we play our own tone in-page
    tag: 'nexus-arrival',
    renotify: true,
    requireInteraction: true,
    data: { url },
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.showNotification) {
        await reg.showNotification(title, options);
        return;
      }
    }
  } catch {
    // Fall through to page Notification.
  }

  try {
    const n = new Notification(title, options);
    n.onclick = () => {
      window.focus();
      opts?.onClick?.();
      n.close();
    };
  } catch {
    // Blocked outside a secure context or by OS settings.
  }
}

export async function announceArrival(opts: {
  title: string;
  body: string;
  onClick?: () => void;
  url?: string;
  playSound?: boolean;
}) {
  if (opts.playSound !== false) {
    await playAlertTone();
  }
  await showBrowserNotification(opts.title, opts.body, {
    onClick: opts.onClick,
    url: opts.url,
  });
}
