import { useEffect, useState } from 'react';
import { Card, Badge, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { screeningApi, ScreeningLog } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { ShieldAlert, Copy } from 'lucide-react';

export default function ScreeningPage() {
  const { locationId } = useActiveLocation();
  const [text, setText] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScreeningLog | null>(null);
  const [history, setHistory] = useState<ScreeningLog[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    screeningApi.history(locationId).then(({ logs }) => setHistory(logs));
  }, [locationId]);

  async function check() {
    if (!locationId || !text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await screeningApi.check({ locationId, reviewText: text, ownerContext: context });
      setResult(res as any);
      const { logs } = await screeningApi.history(locationId);
      setHistory(logs);
    } finally {
      setLoading(false);
    }
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  const isViolation = result && /likely violation/i.test(result.verdict);

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-1">Screen a review</h1>
      <p className="text-sm text-ink-soft mb-1 max-w-lg">
        For reviews that landed directly on Google that look off. This checks against Google's actual content
        policies — spam, conflicts of interest, harassment.
      </p>
      <p className="text-sm font-medium text-ink mb-6">It will never flag a review for being negative.</p>

      <Card className="mb-6">
        <label className="block text-sm font-medium mb-1.5">Paste the review text</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder="Paste the review exactly as it appears on Google..."
          className="w-full border border-line rounded-lg p-3 text-sm mb-3 focus:border-brand outline-none resize-none"
        />
        <label className="block text-sm font-medium mb-1.5">Context (optional)</label>
        <input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="e.g. no record of this person ordering..."
          className="w-full border border-line rounded-lg p-2.5 text-sm mb-4 focus:border-brand outline-none"
        />
        <Button onClick={check} loading={loading} disabled={!text.trim()}>
          <ShieldAlert className="w-4 h-4" /> Check against policy
        </Button>

        {result && (
          <div className="mt-5 pt-5 border-t border-line">
            <div className="flex items-center gap-2 mb-2">
              <Badge tone={isViolation ? 'danger' : 'neutral'}>{result.verdict}</Badge>
              {result.category !== 'none' && <span className="text-xs text-ink-soft">{result.category}</span>}
            </div>
            <p className="text-sm leading-relaxed mb-3">{result.reasoning}</p>
            {isViolation && result.flagText !== 'N/A' && (
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1.5">
                  Suggested reasoning for Google's flag form
                </label>
                <textarea readOnly value={result.flagText} rows={3} className="w-full border border-line rounded-lg p-2.5 text-sm bg-paper mb-2 resize-none" />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(result.flagText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy reasoning'}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">Previously screened</h2>
      {history.length === 0 ? (
        <p className="text-sm text-ink-soft">Nothing screened yet.</p>
      ) : (
        <div className="space-y-2">
          {history.map((h) => (
            <Card key={h.id} className="py-3">
              <div className="flex items-center justify-between mb-1">
                <Badge tone={/likely violation/i.test(h.verdict) ? 'danger' : 'neutral'}>{h.verdict}</Badge>
                <span className="text-xs text-ink-soft">{new Date(h.createdAt).toLocaleDateString()}</span>
              </div>
              <p className="text-xs text-ink-soft italic">"{h.reviewText.slice(0, 120)}{h.reviewText.length > 120 ? '...' : ''}"</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
