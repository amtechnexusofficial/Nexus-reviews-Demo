import { useEffect, useState } from 'react';
import { Card, Badge, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { screeningApi, ScreeningLog } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { Shield } from 'lucide-react';
import { useToast } from '../../lib/toast';

type LastScan = { scanned: number; flagged: number; at: string };

export default function ScreeningPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess, showError } = useToast();
  const [lastScan, setLastScan] = useState<LastScan | null>(null);
  const [flagged, setFlagged] = useState<ScreeningLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const { lastScan, flagged } = await screeningApi.status(locationId);
      setLastScan(lastScan);
      setFlagged(flagged);
    } catch (e: any) {
      showError(e.message || 'Could not load screening status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function screenNow() {
    if (!locationId) return;
    setScanning(true);
    try {
      const res = await screeningApi.screenUnscanned(locationId);
      setLastScan({ scanned: res.scanned, flagged: res.flagged, at: res.at || new Date().toISOString() });
      const { flagged } = await screeningApi.status(locationId);
      setFlagged(flagged);
      showSuccess(
        res.scanned === 0
          ? 'No unscanned low-star reviews right now.'
          : `Screened ${res.scanned} review${res.scanned === 1 ? '' : 's'} — ${res.flagged} flagged.`
      );
    } catch (e: any) {
      showError(e.message || 'Screening failed.');
    } finally {
      setScanning(false);
    }
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  function formatScanTime(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-2">Screening</h1>
      <p className="text-sm text-ink-soft mb-6 leading-relaxed">
        Reviews rated 3★ or lower are checked automatically for Google policy issues (spam, conflicts of
        interest, harassment) — not for being negative. New low-star reviews are screened as they sync in.{' '}
        <span className="font-medium text-ink">
          4–5★ reviews are skipped. It will never flag a review for being negative.
        </span>
      </p>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading...</p>
      ) : (
        <>
          <Card className="mb-6">
            <h2 className="font-semibold text-sm mb-3">Last scan</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="rounded-xl border border-line bg-paper/60 p-3">
                <div className="text-xs text-ink-soft mb-1">Reviews scanned</div>
                <div className="font-display text-2xl font-semibold">{lastScan?.scanned ?? 0}</div>
              </div>
              <div className="rounded-xl border border-line bg-paper/60 p-3">
                <div className="text-xs text-ink-soft mb-1">Flagged</div>
                <div className="font-display text-2xl font-semibold text-danger">{lastScan?.flagged ?? 0}</div>
              </div>
            </div>
            {lastScan?.at && (
              <p className="text-xs text-ink-soft mb-4">{formatScanTime(lastScan.at)}</p>
            )}
            <Button size="sm" variant="secondary" onClick={screenNow} loading={scanning}>
              <Shield className="w-3.5 h-3.5" /> Screen unscanned now
            </Button>
          </Card>

          <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">
            Flagged reviews
          </h2>
          {flagged.length === 0 ? (
            <p className="text-sm text-ink-soft">No policy flags yet for this location.</p>
          ) : (
            <div className="space-y-2">
              {flagged.map((h) => (
                <Card key={h.id} className="py-3">
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <Badge tone="danger">{h.verdict}</Badge>
                    <span className="text-xs text-ink-soft">
                      {new Date(h.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {h.category && h.category !== 'none' && (
                    <div className="text-xs text-ink-soft mb-1 capitalize">{h.category}</div>
                  )}
                  <p className="text-xs text-ink-soft italic mb-2">
                    &quot;{h.reviewText.slice(0, 160)}
                    {h.reviewText.length > 160 ? '…' : ''}&quot;
                  </p>
                  {h.reasoning && (
                    <div className="mt-2 pt-2 border-t border-line">
                      <div className="text-xs font-medium text-ink mb-0.5">Why it was flagged</div>
                      <p className="text-xs text-ink-soft leading-relaxed">{h.reasoning}</p>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
