import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Phone } from 'lucide-react';
import { Card, Badge, StarRating, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { feedbackApi, PrivateFeedbackItem } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';
import { playAlertTone } from '../../lib/arrivalAlerts';

const POLL_INTERVAL_MS = 20_000; // check every 20s while the page is open

export default function FeedbackInboxPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess } = useToast();
  const [items, setItems] = useState<PrivateFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const previousUnresolvedCount = useRef<number | null>(null);

  async function load(isPoll = false) {
    if (!locationId) return;
    if (!isPoll) setLoading(true);
    const { feedback } = await feedbackApi.list(locationId);
    const sorted = feedback.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    setItems(sorted);

    const unresolvedNow = sorted.filter((f) => !f.resolved).length;
    if (previousUnresolvedCount.current !== null && unresolvedNow > previousUnresolvedCount.current) {
      const added = unresolvedNow - previousUnresolvedCount.current;
      playAlertTone();
      setNewAlertCount((n) => n + added);
    }
    previousUnresolvedCount.current = unresolvedNow;
    if (!isPoll) setLoading(false);
  }

  useEffect(() => {
    load();
    const interval = setInterval(() => load(true), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function resolve(id: number) {
    await feedbackApi.resolve(id);
    await load();
    showSuccess('Marked resolved.');
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  const unresolved = items.filter((f) => !f.resolved);
  const resolved = items.filter((f) => f.resolved);

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="font-display text-2xl font-semibold">Feedback Inbox</h1>
        {newAlertCount > 0 && <Badge tone="warning">{newAlertCount} new</Badge>}
      </div>
      <p className="text-sm text-ink-soft mb-6">
        Private messages from customers, sent alongside — not instead of — their public review. Checks for
        new ones every 20 seconds while this page is open, with a sound alert.
      </p>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading...</p>
      ) : unresolved.length === 0 && resolved.length === 0 ? (
        <EmptyState title="No feedback yet" body="Appears here when a customer uses the private feedback option in your kiosk." />
      ) : (
        <>
          {unresolved.length > 0 && (
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-warning uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Needs attention ({unresolved.length})
              </h2>
              <div className="space-y-3">
                {unresolved.map((f) => (
                  <Card key={f.id} className="border-amber-200">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <StarRating value={f.rating} readOnly size={16} />
                      <span className="text-xs text-ink-soft">{new Date(f.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm leading-relaxed mb-3">{f.message}</p>
                    {f.customerContact && (
                      <p className="text-xs text-ink-soft flex items-center gap-1 mb-3">
                        <Phone className="w-3 h-3" /> {f.customerContact}
                      </p>
                    )}
                    <Button size="sm" onClick={() => resolve(f.id)}>
                      <Check className="w-3.5 h-3.5" /> Mark resolved
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">
                Resolved ({resolved.length})
              </h2>
              <div className="space-y-2">
                {resolved.map((f) => (
                  <Card key={f.id} className="py-3 opacity-60">
                    <div className="flex items-center justify-between mb-1">
                      <StarRating value={f.rating} readOnly size={14} />
                      <Badge tone="success">Resolved</Badge>
                    </div>
                    <p className="text-xs text-ink-soft">{f.message}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
