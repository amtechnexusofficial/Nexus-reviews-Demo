import { useEffect, useState } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import { Card, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { analyticsApi, AnalyticsSnapshot } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';

export default function AnalyticsPage() {
  const { locationId } = useActiveLocation();
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!locationId) return;
    analyticsApi.list(locationId).then(({ snapshots }) => {
      setSnapshots(snapshots);
      setLoading(false);
    });
  }, [locationId]);

  async function generate() {
    if (!locationId) return;
    setGenerating(true);
    setError('');
    try {
      const { snapshot } = await analyticsApi.generate(locationId, 30);
      setSnapshots((prev) => [snapshot, ...prev]);
    } catch {
      setError("Couldn't generate insights right now — try again in a moment.");
    } finally {
      setGenerating(false);
    }
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  const latest = snapshots[0];

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold">Insights</h1>
        <Button size="sm" onClick={generate} loading={generating}>
          <Sparkles className="w-3.5 h-3.5" /> Generate fresh insights
        </Button>
      </div>
      <p className="text-sm text-ink-soft mb-6">
        An AI read of your last 30 days of reviews — specific patterns, not generic sentiment counts.
      </p>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {loading ? (
        <p className="text-sm text-ink-soft">Loading...</p>
      ) : !latest ? (
        <EmptyState
          title="No insights generated yet"
          body="Click 'Generate fresh insights' to get an AI read of your recent reviews."
        />
      ) : (
        <div className="space-y-5">
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-brand" />
              <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
                {latest.periodLabel} · {latest.reviewCountAnalyzed} reviews analyzed
              </span>
            </div>
            <p className="text-sm leading-relaxed">{latest.summary}</p>
          </Card>

          {latest.recommendations.length > 0 && (
            <Card>
              <h2 className="font-semibold text-sm mb-3">What to do this week</h2>
              <ul className="space-y-2">
                {latest.recommendations.map((rec, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed">
                    <span className="text-brand font-semibold shrink-0">{i + 1}.</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {snapshots.length > 1 && (
            <div>
              <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">Previous reports</h2>
              <div className="space-y-2">
                {snapshots.slice(1).map((s) => (
                  <Card key={s.id} className="py-3">
                    <div className="text-xs text-ink-soft mb-1">{new Date(s.createdAt).toLocaleDateString()}</div>
                    <p className="text-sm">{s.summary}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
