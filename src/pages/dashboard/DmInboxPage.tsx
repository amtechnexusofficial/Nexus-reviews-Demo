import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Bot, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, EmptyState, Badge } from '../../components/ui';
import { Button } from '../../components/Button';
import { dmsApi, dmStatusApi, DmChat, DmMessage, DmConversation } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';
import { useDmAlerts } from '../../lib/DmAlertsContext';
import { chatActivityAt, chatKey, isChatUnread, markChatRead } from '../../lib/dmUnread';

type PlatformFilter = 'all' | 'instagram' | 'facebook';

type InboxChat = DmChat & { platform: string };

const DM_PLATFORMS = ['instagram', 'facebook'] as const;

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
};

const FILTERS: { id: PlatformFilter; label: string }[] = [
  { id: 'all', label: 'All platforms' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
];

const STATUS_CONFIG: Record<string, { label: string; tone: 'brand' | 'warning' | 'success'; icon: any }> = {
  ai_handling: { label: 'AI handling', tone: 'brand', icon: Bot },
  escalated: { label: 'Needs you', tone: 'warning', icon: AlertCircle },
  human_takeover: { label: "You're handling", tone: 'success', icon: UserCheck },
};

const POLL_MS = 10_000;

function platformsForFilter(filter: PlatformFilter): string[] {
  return filter === 'all' ? [...DM_PLATFORMS] : [filter];
}

export default function DmInboxPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess, showError } = useToast();
  const { unreadKeys, markLocallyRead } = useDmAlerts();

  const [filter, setFilter] = useState<PlatformFilter>('all');
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [chats, setChats] = useState<InboxChat[]>([]);
  const [conversationStatuses, setConversationStatuses] = useState<Record<string, DmConversation>>({});
  const [activeChat, setActiveChat] = useState<InboxChat | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [switchingStatus, setSwitchingStatus] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!locationId) return;
    loadStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  useEffect(() => {
    if (locationId) loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, locationId]);

  useEffect(() => {
    if (!locationId) return;

    let cancelled = false;
    let inFlight = false;

    async function poll() {
      if (cancelled || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const fresh = await fetchChats(locationId!, filter);
        if (cancelled) return;
        setChats(fresh);
        setChatsError(null);
      } catch {
        // Keep visible chats on background refresh failure.
      } finally {
        inFlight = false;
      }
    }

    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [locationId, filter]);

  useEffect(() => {
    if (!locationId || !activeChat) return;

    let cancelled = false;
    let inFlight = false;
    const chatId = activeChat.id;
    const platform = activeChat.platform;

    async function poll() {
      if (cancelled || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const { messages: freshMessages } = await dmsApi.messages(locationId!, platform, chatId);
        if (cancelled) return;
        setMessages(freshMessages);
        const latestInbound = [...freshMessages].reverse().find((m) => m.direction === 'inbound');
        const stamp = latestInbound?.created_at || freshMessages[freshMessages.length - 1]?.created_at;
        if (stamp && locationId) {
          markChatRead(locationId, platform, chatId, stamp);
          markLocallyRead(locationId, platform, chatId);
        }
      } catch {
        // Keep the current thread visible through transient refresh failures.
      } finally {
        inFlight = false;
      }
    }

    const timer = window.setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) poll();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [locationId, activeChat?.id, activeChat?.platform, markLocallyRead]);

  async function fetchChats(locId: number, platformFilter: PlatformFilter): Promise<InboxChat[]> {
    const platforms = platformsForFilter(platformFilter);
    const batches = await Promise.all(platforms.map((p) => dmsApi.chats(locId, p)));
    const merged: InboxChat[] = [];
    platforms.forEach((platform, i) => {
      for (const chat of batches[i].chats) {
        merged.push({ ...chat, platform });
      }
    });
    return merged.sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at));
  }

  async function loadStatuses() {
    if (!locationId) return;
    try {
      const { conversations } = await dmStatusApi.list(locationId);
      const byId: Record<string, DmConversation> = {};
      conversations.forEach((c) => (byId[c.postproxyChatId] = c));
      setConversationStatuses(byId);
    } catch {
      // status tracking is additive — chats still work without it
    }
  }

  async function loadChats() {
    if (!locationId) return;
    setLoadingChats(true);
    setActiveChat(null);
    setMessages([]);
    setChatsError(null);
    try {
      setChats(await fetchChats(locationId, filter));
    } catch (e: any) {
      setChats([]);
      setChatsError(e.message || 'Could not load conversations.');
      showError(e.message || 'Could not load conversations.');
    } finally {
      setLoadingChats(false);
    }
  }

  async function openChat(chat: InboxChat) {
    if (!locationId) return;
    setActiveChat(chat);
    setReplyText('');
    setLoadingMessages(true);
    const activity = chatActivityAt(chat);
    if (activity) {
      markChatRead(locationId, chat.platform, chat.id, activity);
      markLocallyRead(locationId, chat.platform, chat.id);
    }
    try {
      const { messages } = await dmsApi.messages(locationId, chat.platform, chat.id);
      setMessages(messages);
      const latestInbound = [...messages].reverse().find((m) => m.direction === 'inbound');
      const stamp = latestInbound?.created_at || messages[messages.length - 1]?.created_at || activity;
      if (stamp) {
        markChatRead(locationId, chat.platform, chat.id, stamp);
        markLocallyRead(locationId, chat.platform, chat.id);
      }
    } catch (e: any) {
      showError(e.message || 'Could not load this conversation.');
    } finally {
      setLoadingMessages(false);
    }
  }

  async function draftReply() {
    if (!locationId || !activeChat) return;
    setDrafting(true);
    try {
      const { draft } = await dmsApi.draftReply(locationId, activeChat.platform, activeChat.id);
      setReplyText(draft);
    } catch (e: any) {
      showError(e.message || 'Could not generate a draft right now.');
    } finally {
      setDrafting(false);
    }
  }

  async function sendReply() {
    if (!locationId || !activeChat || !replyText.trim()) return;
    setSending(true);
    try {
      await dmsApi.send(locationId, activeChat.platform, activeChat.id, replyText);
      showSuccess('Sent.');
      setReplyText('');
      markChatRead(locationId, activeChat.platform, activeChat.id, new Date().toISOString());
      markLocallyRead(locationId, activeChat.platform, activeChat.id);
      await openChat(activeChat);
    } catch (e: any) {
      showError(e.message || 'Send failed.');
    } finally {
      setSending(false);
    }
  }

  async function takeOver() {
    if (!locationId || !activeChat) return;
    setSwitchingStatus(true);
    try {
      await dmStatusApi.takeOver(locationId, activeChat.id, activeChat.platform);
      await loadStatuses();
      showSuccess("You're now handling this conversation — AI won't auto-reply here.");
    } finally {
      setSwitchingStatus(false);
    }
  }

  async function handBack() {
    if (!locationId || !activeChat) return;
    setSwitchingStatus(true);
    try {
      await dmStatusApi.handBack(locationId, activeChat.id);
      await loadStatuses();
      showSuccess('Handed back to AI.');
    } finally {
      setSwitchingStatus(false);
    }
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  const activeStatus = activeChat ? conversationStatuses[activeChat.id] : null;
  const statusInfo = activeStatus ? STATUS_CONFIG[activeStatus.status] : null;
  const participantLabel = (chat: DmChat) =>
    chat.participant_name ||
    (chat.participant_username ? `@${chat.participant_username.replace(/^@/, '')}` : '') ||
    chat.participant_external_id ||
    'Customer';

  const showingLabels = platformsForFilter(filter)
    .map((p) => PLATFORM_LABELS[p])
    .join(', ');

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-1">DM Inbox</h1>
      <p className="text-sm text-ink-soft mb-5">
        AI can auto-reply to simple questions (turn on in Settings) — anything it's unsure about lands here for you.
      </p>

      <div className="flex gap-2 mb-2 flex-wrap items-center">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              filter === f.id ? 'bg-brand-soft text-brand border-transparent' : 'border-line text-ink-soft'
            }`}
          >
            {f.label}
          </button>
        ))}
        <Button size="sm" variant="ghost" onClick={loadChats} loading={loadingChats}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <p className="text-xs text-ink-soft mb-5">
        Showing conversations from <strong>{showingLabels}.</strong>
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-1 space-y-2">
          {loadingChats ? (
            <p className="text-sm text-ink-soft">Loading...</p>
          ) : chatsError ? (
            <p className="text-sm text-danger border border-danger/30 bg-danger/5 rounded-lg p-3">{chatsError}</p>
          ) : chats.length === 0 ? (
            <p className="text-sm text-ink-soft">No conversations yet.</p>
          ) : (
            chats.map((chat) => {
              const status = conversationStatuses[chat.id];
              const info = status ? STATUS_CONFIG[status.status] : null;
              const unread =
                !!locationId &&
                (unreadKeys.has(chatKey(locationId, chat.platform, chat.id)) ||
                  isChatUnread(locationId, chat.platform, chat));
              return (
                <button
                  key={`${chat.platform}:${chat.id}`}
                  onClick={() => openChat(chat)}
                  className={`w-full text-left p-3 rounded-lg border ${
                    activeChat?.id === chat.id && activeChat?.platform === chat.platform
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {chat.participant_avatar_url ? (
                        <img
                          src={chat.participant_avatar_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-line shrink-0 flex items-center justify-center text-[10px] font-semibold text-ink-soft uppercase">
                          {(participantLabel(chat)[0] || '?')}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className={`text-sm truncate ${unread ? 'font-semibold text-ink' : 'font-medium'}`}>
                          {participantLabel(chat)}
                          {unread && (
                            <span
                              className="inline-block w-2 h-2 rounded-full bg-emerald-500 ml-1.5 align-middle"
                              title="Unread"
                            />
                          )}
                        </div>
                        <div className="text-xs text-ink-soft">
                          {new Date(chat.last_message_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {info && <Badge tone={info.tone}>{info.label}</Badge>}
                      <span className="text-[10px] uppercase tracking-wide text-ink-soft">
                        {PLATFORM_LABELS[chat.platform] || chat.platform}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="md:col-span-2">
          {!activeChat ? (
            <Card className="h-full min-h-[280px]" />
          ) : (
            <Card>
              <div className="font-semibold text-sm mb-3 pb-3 border-b border-line flex items-center justify-between gap-2">
                <span>{participantLabel(activeChat)}</span>
                <span className="text-[10px] uppercase tracking-wide text-ink-soft font-medium">
                  {PLATFORM_LABELS[activeChat.platform] || activeChat.platform}
                </span>
              </div>
              {statusInfo && (
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-line">
                  <Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>
                  {activeStatus?.status === 'escalated' && activeStatus.escalationReason && (
                    <span className="text-xs text-ink-soft">{activeStatus.escalationReason}</span>
                  )}
                  {activeStatus?.status === 'human_takeover' ? (
                    <Button size="sm" variant="ghost" onClick={handBack} loading={switchingStatus}>
                      Hand back to AI
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={takeOver} loading={switchingStatus}>
                      Take over
                    </Button>
                  )}
                </div>
              )}

              <div ref={threadRef} className="max-h-80 overflow-y-auto space-y-2 mb-4 pb-4 border-b border-line">
                {loadingMessages ? (
                  <p className="text-sm text-ink-soft">Loading...</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                          m.direction === 'outbound' ? 'bg-brand text-white' : 'bg-paper border border-line'
                        }`}
                      >
                        {m.body}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={3}
                placeholder="Write a reply, or generate one from the conversation..."
                className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none resize-none"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={draftReply} loading={drafting}>
                  <Sparkles className="w-3.5 h-3.5" /> AI draft
                </Button>
                <Button size="sm" onClick={sendReply} loading={sending} disabled={!replyText.trim()}>
                  <Send className="w-3.5 h-3.5" /> Send
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
