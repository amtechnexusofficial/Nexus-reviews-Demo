const READ_KEY = 'nexus-dm-read-v1';
const ALERTED_KEY = 'nexus-dm-alerted-v1';

type StampMap = Record<string, string>; // `${locationId}:${platform}:${chatId}` → ISO

function loadMap(storageKey: string): StampMap {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '{}') as StampMap;
  } catch {
    return {};
  }
}

function saveMap(storageKey: string, map: StampMap) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(map));
  } catch {
    // Quota / private mode — alerts may re-fire after refresh.
  }
}

export function chatKey(locationId: number, platform: string, chatId: string) {
  return `${locationId}:${platform}:${chatId}`;
}

/** Best stamp for "new customer activity" on a chat. */
export function chatActivityAt(chat: {
  last_inbound_at?: string | null;
  last_message_at?: string | null;
}) {
  return chat.last_inbound_at || chat.last_message_at || '';
}

export function getChatReadAt(locationId: number, platform: string, chatId: string): string | null {
  return loadMap(READ_KEY)[chatKey(locationId, platform, chatId)] || null;
}

export function markChatRead(
  locationId: number,
  platform: string,
  chatId: string,
  at: string
) {
  if (!at) return;
  const all = loadMap(READ_KEY);
  const key = chatKey(locationId, platform, chatId);
  const prev = all[key];
  if (!prev || +new Date(at) > +new Date(prev)) {
    all[key] = at;
    saveMap(READ_KEY, all);
  }
  // Opening/reading also consumes the alert so refresh won't re-ding.
  markChatAlerted(locationId, platform, chatId, at);
}

/** First time we see a chat, treat current activity as already read (no flood of old dots). */
export function ensureChatBaselined(
  locationId: number,
  platform: string,
  chatId: string,
  activityAt: string
) {
  if (!activityAt) return;
  const all = loadMap(READ_KEY);
  const key = chatKey(locationId, platform, chatId);
  if (!all[key]) {
    all[key] = activityAt;
    saveMap(READ_KEY, all);
  }
  markChatAlerted(locationId, platform, chatId, activityAt);
}

export function isChatUnread(
  locationId: number,
  platform: string,
  chat: { id: string; last_inbound_at?: string | null; last_message_at?: string | null }
) {
  const activity = chatActivityAt(chat);
  if (!activity) return false;
  const readAt = getChatReadAt(locationId, platform, chat.id);
  if (!readAt) return false;
  return +new Date(activity) > +new Date(readAt);
}

export function getChatAlertedAt(locationId: number, platform: string, chatId: string): string | null {
  return loadMap(ALERTED_KEY)[chatKey(locationId, platform, chatId)] || null;
}

export function markChatAlerted(
  locationId: number,
  platform: string,
  chatId: string,
  at: string
) {
  if (!at) return;
  const all = loadMap(ALERTED_KEY);
  const key = chatKey(locationId, platform, chatId);
  const prev = all[key];
  if (!prev || +new Date(at) > +new Date(prev)) {
    all[key] = at;
    saveMap(ALERTED_KEY, all);
  }
}

/** True when activity is newer than the last time we sounded/notified for this chat. */
export function shouldAlertForChat(
  locationId: number,
  platform: string,
  chat: { id: string; last_inbound_at?: string | null; last_message_at?: string | null }
) {
  const activity = chatActivityAt(chat);
  if (!activity) return false;
  if (!isChatUnread(locationId, platform, chat)) return false;
  const alertedAt = getChatAlertedAt(locationId, platform, chat.id);
  if (!alertedAt) return true;
  return +new Date(activity) > +new Date(alertedAt);
}
