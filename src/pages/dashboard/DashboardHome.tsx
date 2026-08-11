import { useEffect, useMemo, useState } from 'react';
import { Star, MessageSquareText, QrCode, Download } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { Card, EmptyState } from '../../components/ui';
import { reviewsApi, kioskApi, reportsApi, type Review } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';

const RATING_COLORS: Record<number, string> = {
  1: '#EF4444',
  2: '#F97316',
  3: '#F5B301',
  4: '#84CC16',
  5: '#22C55E',
};

function buildTrend(reviews: Review[]) {
  // Bucket reviews into 6 weekly buckets covering the last ~6 weeks and
  // compute the running average rating for each bucket.
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const buckets = Array.from({ length: 6 }).map((_, i) => ({
    label: i === 5 ? 'This week' : `${(5 - i) + 1}w ago`,
    start: now - (6 - i) * weekMs,
    end: now - (5 - i) * weekMs,
    ratings: [] as number[],
  }));
  for (const r of reviews) {
    const t = +new Date(r.reviewCreatedAt);
    const bucket = buckets.find((b) => t >= b.start && t < b.end) || buckets[buckets.length - 1];
    bucket.ratings.push(r.rating);
  }
  return buckets.map((b) => ({
    label: b.label,
    avg: b.ratings.length ? +(b.ratings.reduce((s, v) => s + v, 0) / b.ratings.length).toFixed(2) : null,
    count: b.ratings.length,
  }));
}

function buildDistribution(reviews: Review[]) {
  return [1, 2, 3, 4, 5].map((star) => ({
    star: `${star}\u2605`,
    starNum: star,
    count: reviews.filter((r) => r.rating === star).length,
  }));
}

export default function DashboardHome() {
  const { locationId } = useActiveLocation();
  const [reviews, setReviews] = useState<Review[]>([]);
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
      const avg = total ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : '\u2014';
      const unanswered = reviews.filter((r) => !r.hasResponse).length;
      setReviews(reviews);
      setStats({ total, avg, unanswered, kioskDrafts: sessions.length });
      setLoading(false);
    })();
  }, [locationId]);

  const trend = useMemo(() => buildTrend(reviews), [reviews]);
  const distribution = useMemo(() => buildDistribution(reviews), [reviews]);

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
        <>
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

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Card>
              <div className="text-sm font-semibold mb-1">Rating trend</div>
              <div className="text-xs text-ink-soft mb-3">Average rating by week</div>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8A8A99' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#8A8A99' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: any, name: string) => (name === 'avg' ? [`${value}\u2605`, 'Avg rating'] : [value, name])}
                      contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="avg" stroke="var(--brand-color, #7C3AED)" strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div className="text-sm font-semibold mb-1">Rating distribution</div>
              <div className="text-xs text-ink-soft mb-3">All-time breakdown by star rating</div>
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={distribution} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
                    <XAxis dataKey="star" tick={{ fontSize: 11, fill: '#8A8A99' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#8A8A99' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value: any) => [value, 'Reviews']}
                      contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {distribution.map((d) => (
                        <Cell key={d.starNum} fill={RATING_COLORS[d.starNum]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </>
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
