import { useEffect, useRef, useState } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { EmptyState } from '../../components/ui';
import { chatApi, ChatMessage } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';

const SUGGESTIONS = [
  'Why are ratings dropping?',
  'What should I improve first?',
  'What do customers love most?',
];

export default function AdvisorPage() {
  const { locationId } = useActiveLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!locationId) return;
    chatApi.history(locationId).then(({ messages }) => setMessages(messages));
  }, [locationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function ask(q: string) {
    if (!locationId || !q.trim()) return;
    setAsking(true);
    setQuestion('');
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: q, createdAt: new Date().toISOString() }]);
    try {
      const { answer } = await chatApi.ask(locationId, q);
      setMessages((prev) => [...prev, answer]);
    } finally {
      setAsking(false);
    }
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] md:h-dvh max-w-2xl mx-auto">
      <div className="px-5 md:px-8 pt-5 md:pt-8 pb-3 border-b border-line">
        <h1 className="font-display text-2xl font-semibold">Advisor</h1>
        <p className="text-sm text-ink-soft">Ask anything about your reviews — grounded in your real data only.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 md:px-8 py-4 space-y-4">
        {messages.length === 0 && (
          <div>
            <p className="text-sm text-ink-soft mb-3">Try asking:</p>
            <div className="flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="text-left text-sm px-3.5 py-2.5 rounded-lg border border-line hover:border-brand hover:bg-brand-soft transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                m.role === 'user' ? 'bg-brand text-white' : 'bg-white border border-line'
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {asking && (
          <div className="flex justify-start">
            <div className="bg-white border border-line rounded-2xl px-4 py-2.5 text-sm text-ink-soft flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" /> Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 border-t border-line bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 border border-line rounded-full px-4 py-2.5 text-sm focus:border-brand outline-none"
          />
          <button
            type="submit"
            disabled={!question.trim() || asking}
            className="w-10 h-10 rounded-full bg-brand text-white flex items-center justify-center disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
