import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Bot } from 'lucide-react';
import { Card, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { knowledgeApi, KnowledgeEntry } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';

export default function AiAgentPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess } = useToast();

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [adding, setAdding] = useState(false);

  async function load() {
    if (!locationId) return;
    const { entries } = await knowledgeApi.list(locationId);
    setEntries(entries);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function addEntry() {
    if (!locationId || !title.trim() || !content.trim()) return;
    setAdding(true);
    try {
      await knowledgeApi.create({ locationId, title, content });
      setTitle('');
      setContent('');
      await load();
      showSuccess('Added to the knowledge base.');
    } finally {
      setAdding(false);
    }
  }

  async function removeEntry(id: number) {
    await knowledgeApi.remove(id);
    await load();
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-1 flex items-center gap-2">
        <Bot className="w-6 h-6 text-brand" /> AI Agent
      </h1>
      <p className="text-sm text-ink-soft mb-6">
        Teach the AI extra facts for this location. Turn automatic DM replies on or off in{' '}
        <Link to="/dashboard/settings" className="text-brand underline font-medium">
          Settings
        </Link>
        .
      </p>

      <Card className="mb-6">
        <h2 className="font-semibold text-sm mb-1">Teach it about your business</h2>
        <p className="text-xs text-ink-soft mb-4">
          Menu items, prices, policies, FAQs — plain text only for now. Your website and general business
          context from Settings are included automatically too.
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title — e.g. 'Opening hours', 'Menu'"
          className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          placeholder="Paste the actual details here..."
          className="w-full border border-line rounded-lg p-2.5 text-sm mb-3 focus:border-brand outline-none resize-none"
        />
        <Button size="sm" onClick={addEntry} loading={adding} disabled={!title.trim() || !content.trim()}>
          Add to knowledge base
        </Button>
      </Card>

      {entries.length === 0 ? (
        <EmptyState
          title="No knowledge added yet"
          body="Add your hours, menu, or policies above so the AI can answer questions about them."
        />
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={entry.id} className="py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="font-medium text-sm">{entry.title}</div>
                  <p className="text-xs text-ink-soft mt-1 line-clamp-2">{entry.content}</p>
                </div>
                <button onClick={() => removeEntry(entry.id)} className="text-ink-soft hover:text-danger shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
