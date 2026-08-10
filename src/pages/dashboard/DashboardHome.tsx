import { useEffect, useState } from 'react';
import { Star, MessageSquareText, QrCode, Download } from 'lucide-react';
import { Card, EmptyState } from '../../components/ui';
import { reviewsApi, kioskApi, reportsApi } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';

export default function DashboardHome() {
  const { locationId } = useActiveLocation();
  const [stats, setStats] = useState<{ total: number; avg: string; unanswered: number; kioskDrafts: number } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const [{ reviews }, { sessions }] = await Promise.all([
        reviewsApi.list(locationId),
        kioskApi.listForLocation(locationId),
      ]);
      const total = reviews.length;
      const avg = total ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : '—';
      const unanswered = reviews.filter((r) => !r.hasResponse).length;
      setStats({ total, avg, unanswered, kioskDrafts: sessions.length });
      setLoading(false);
    })();
  }, [locationId]);

  if (!locationId) {
    return (
      <EmptyState
        title="No business connected yet"
        body="Set up your business and link it to ReviewHook in Settings to start seeing your reviews here."
        action={
          <Link to="/dashboard/settings">
            <Button>Go to Settings</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-6">Overview</h1>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <Star className="w-5 h-5 text-brand mb-2" />
            <div className="font-display text-2xl font-semibold">{stats?.avg}</div>
            <div className="text-xs text-ink-soft">Average rating</div>
          </Card>
          <Card>
            <MessageSquareText className="w-5 h-5 text-brand mb-2" />
            <div className="font-display text-2xl font-semibold">{stats?.total}</div>
            <div className="text-xs text-ink-soft">Total reviews</div>
          </Card>
          <Card>
            <div className="w-5 h-5 rounded-full bg-warning/20 flex items-center justify-center mb-2">
              <span className="w-2 h-2 rounded-full bg-warning" />
            </div>
            <div className="font-display text-2xl font-semibold">{stats?.unanswered}</div>
            <div className="text-xs text-ink-soft">Awaiting reply</div>
          </Card>
          <Card>
            <QrCode className="w-5 h-5 text-brand mb-2" />
            <div className="font-display text-2xl font-semibold">{stats?.kioskDrafts}</div>
            <div className="text-xs text-ink-soft">Kiosk drafts collected</div>
          </Card>
        </div>
      )}

      <div className="flex gap-3 mt-6 flex-wrap">
        <Button variant="secondary" size="sm" onClick={() => reportsApi.downloadReviews(locationId)}>
          <Download className="w-3.5 h-3.5" /> Export reviews CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={() => reportsApi.downloadKioskDrafts(locationId)}>
          <Download className="w-3.5 h-3.5" /> Export kiosk drafts CSV
        </Button>
      </div>
    </div>
  );
}
