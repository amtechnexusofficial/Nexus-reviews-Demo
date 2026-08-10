import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Bot, UserCheck, AlertCircle, RefreshCw } from 'lucide-react';
import { Card, EmptyState, Badge } from '../../components/ui';
import { Button } from '../../components/Button';
import { dmsApi, dmStatusApi, DmChat, DmMessage, DmConversation } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';
import { useDmAlerts } from '../../lib/DmAlertsContext';
import { chatActivityAt, chatKey, isChatUnread, markChatRead } from '../../lib/dmUnread';

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  telegram: 'Telegram',
  bluesky: 'Bluesky',
};

const STATUS_CONFIG: Record<string, { label: string; tone: 'brand' | 'warning' | 'success'; icon: any }> = {
  ai_handling: { label: 'AI handling', tone: 'brand', icon: Bot },
  escalated: { label: 'Needs you', tone: 'warning', icon: AlertCircle },
  human_takeover: { label: "You're handling", tone: 'success', icon: UserCheck },
};

// How often the open DM inbox re-fetches from Postproxy. Keep this gentle —
// each tick can hit chats + messages, and each of those has a CORS preflight.
const POLL_MS = 10_000;

export default function DmInboxPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess, showError } = useToast();
  const { unreadKeys, markLocallyRead } = useDmAlerts();

  const [platforms, setPlatforms] = useState<{ platform: string; name?: string }[]>([]);
  const [chatsError, setChatsError] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState('');
  const [chats, setChats] = useState<DmChat[]>([]);
  const [conversationStatuses, setConversationStatuses] = useState<Record<string, DmConversation>>({});
  const [activeChat, setActiveChat] = useState<DmChat | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [sending, setSending] = useState(false);
  const [switchingStatus, setSwitchingStatus] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // The newest message sits at the bottom, so jump there whenever the thread
  // changes — otherwise an incoming reply lands out of view.
  useEffect(() => {
    const thread = threadRef.current;
    if (thread) thread.scrollTop = thread.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!locationId) return;
    dmsApi.platforms(locationId).then(({ platforms }) => {
      setPlatforms(platforms);
      if (platforms[0]) setActivePlatform(platforms[0].platform);
    });
    loadStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  useEffect(() => {
    if (locationId && activePlatform) loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePlatform, locationId]);

  // Postproxy receives Meta DMs by webhook, but this browser has no persistent
  // connection to our Worker. Poll gently so the inbox stays current without
  // burning quota — especially while a thread is open (two endpoints).
  useEffect(() => {
    if (!locationId || !activePlatform) return;

    let cancelled = false;
    let inFlight = false;

    async function poll() {
      if (cancelled || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const { chats: freshChats } = await dmsApi.chats(locationId!, activePlatform);
        if (cancelled) return;
        setChats(freshChats.sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at)));
        setChatsError(null);
      } catch {
        // A background refresh failure should not replace already-visible chats.
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
  }, [locationId, activePlatform]);

  // Refresh an open thread too, so an inbound message appears without the
  // owner reselecting the conversation. This never touches replyText.
  useEffect(() => {
    if (!locationId || !activePlatform || !activeChat) return;

    let cancelled = false;
    let inFlight = false;
    const chatId = activeChat.id;

    async function poll() {
      if (cancelled || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const { messages: freshMessages } = await dmsApi.messages(locationId!, activePlatform, chatId);
        if (cancelled) return;
        setMessages(freshMessages);
        const latestInbound = [...freshMessages].reverse().find((m) => m.direction === 'inbound');
        const stamp = latestInbound?.created_at || freshMessages[freshMessages.length - 1]?.created_at;
        if (stamp && locationId) {
          markChatRead(locationId, activePlatform, chatId, stamp);
          markLocallyRead(locationId, activePlatform, chatId);
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
  }, [locationId, activePlatform, activeChat?.id, markLocallyRead]);

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
    if (!locationId || !activePlatform) return;
    setLoadingChats(true);
    setActiveChat(null);
    setMessages([]);
    setChatsError(null);
    try {
      const { chats } = await dmsApi.chats(locationId, activePlatform);
      setChats(chats.sort((a, b) => +new Date(b.last_message_at) - +new Date(a.last_message_at)));
    } catch (e: any) {
      // Keeping the reason on screen matters here — a failed fetch and a
      // genuinely empty inbox otherwise look identical.
      setChats([]);
      setChatsError(e.message || 'Could not load conversations.');
      showError(e.message || 'Could not load conversations.');
    } finally {
      setLoadingChats(false);
    }
  }

  async function openChat(chat: DmChat) {
    if (!locationId) return;
    setActiveChat(chat);
    setReplyText('');
    setLoadingMessages(true);
    const activity = chatActivityAt(chat);
    if (activity) {
      markChatRead(locationId, activePlatform, chat.id, activity);
      markLocallyRead(locationId, activePlatform, chat.id);
    }
    try {
      const { messages } = await dmsApi.messages(locationId, activePlatform, chat.id);
      setMessages(messages);
      // After loading, mark read at the newest inbound (or last message) so the
      // green dot clears even if the chat list stamp was slightly stale.
      const latestInbound = [...messages].reverse().find((m) => m.direction === 'inbound');
      const stamp = latestInbound?.created_at || messages[messages.length - 1]?.created_at || activity;
      if (stamp) {
        markChatRead(locationId, activePlatform, chat.id, stamp);
        markLocallyRead(locationId, activePlatform, chat.id);
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
      const { draft } = await dmsApi.draftReply(locationId, activePlatform, activeChat.id);
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
      await dmsApi.send(locationId, activePlatform, activeChat.id, replyText);
      showSuccess('Sent.');
      setReplyText('');
      // Our outbound bump of last_message_at should not look unread.
      markChatRead(locationId, activePlatform, activeChat.id, new Date().toISOString());
      markLocallyRead(locationId, activePlatform, activeChat.id);
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
      await dmStatusApi.takeOver(locationId, activeChat.id, activePlatform);
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

  if (platforms.length === 0) {
    return (
      <EmptyState
        title="No DM-capable platforms connected"
        body="Connect Instagram, Facebook, Telegram, or Bluesky in Connections to see conversations here."
        action={
          <a href="/dashboard/connections" className="text-sm text-brand underline font-medium">
            Go to Connections
          </a>
        }
      />
    );
  }

  const activeStatus = activeChat ? conversationStatuses[activeChat.id] : null;
  const statusInfo = activeStatus ? STATUS_CONFIG[activeStatus.status] : null;
  const participantLabel = (chat: DmChat) =>
    chat.participant_name ||
    (chat.participant_username ? `@${chat.participant_username.replace(/^@/, '')}` : '') ||
    chat.participant_external_id ||
    'Customer';

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-1">DM Inbox</h1>
      <p className="text-sm text-ink-soft mb-5">
        AI can auto-reply to simple questions (turn on in Settings) — anything it's unsure about lands here for you.
      </p>

      <div className="flex gap-2 mb-2 flex-wrap items-center">
        {platforms.map((p) => (
          <button
            key={p.platform}
            onClick={() => setActivePlatform(p.platform)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              activePlatform === p.platform ? 'bg-brand-soft text-brand border-transparent' : 'border-line text-ink-soft'
            }`}
          >
            {PLATFORM_LABELS[p.platform] || p.platform}
          </button>
        ))}
        <Button size="sm" variant="ghost" onClick={loadChats} loading={loadingChats}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <p className="text-xs text-ink-soft mb-5">
        Reading from{' '}
        <strong>{platforms.find((p) => p.platform === activePlatform)?.name || activePlatform}</strong> — make sure
        that's the same account whose chats you see in Postproxy.
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Chat list */}
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
                (unreadKeys.has(chatKey(locationId, activePlatform, chat.id)) ||
                  isChatUnread(locationId, activePlatform, chat));
              return (
                <button
                  key={chat.id}
                  onClick={() => openChat(chat)}
                  className={`w-full text-left p-3 rounded-lg border ${
                    activeChat?.id === chat.id ? 'border-brand bg-brand-soft' : 'border-line bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {chat.participant_avatar_url && (
                        <img
                          src={chat.participant_avatar_url}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover shrink-0"
                        />
                      )}
                      <div className={`text-sm truncate ${unread ? 'font-semibold text-ink' : 'font-medium'}`}>
                        {participantLabel(chat)}
                      </div>
                      {unread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Unread" />
                      )}
                    </div>
                    {info && (
                      <Badge tone={info.tone}>
                        {info.label}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-ink-soft">{new Date(chat.last_message_at).toLocaleString()}</div>
                </button>
              );
            })
          )}
        </div>

        {/* Conversation + reply */}
        <div className="md:col-span-2">
          {!activeChat ? (
            <Card className="h-full flex items-center justify-center text-sm text-ink-soft py-16">
              Select a conversation
            </Card>
          ) : (
            <Card>
              <div className="font-semibold text-sm mb-3 pb-3 border-b border-line">
                {participantLabel(activeChat)}
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
