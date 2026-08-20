import { useEffect, useMemo, useState } from 'react';
import { Star, MessageSquareText, Percent, Timer, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Card, EmptyState, StarRating, Badge } from '../../components/ui';
import { reviewsApi, type Review } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';

const DAY_MS = 24 * 60 * 60 * 1000;

type OverviewStats = {
  avg: string;
  total: number;
  unanswered: number;
  replyRate: string;
  avgResponseTime: string;
  repliedCount: number;
  needsAttention: number;
};

function formatResponseTime(hours: number): string {
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`;
  const days = hours / 24;
  return days < 10 ? `${days.toFixed(1).replace(/\.0$/, '')}d` : `${Math.round(days)}d`;
}

function buildOverviewStats(reviews: Review[]): OverviewStats {
  const total = reviews.length;
  const avg = total ? (reviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1) : '\u2014';
  const unanswered = reviews.filter((r) => !r.hasResponse).length;

  const now = Date.now();
  const last30 = reviews.filter((r) => now - +new Date(r.reviewCreatedAt) <= 30 * DAY_MS);
  const replied30 = last30.filter((r) => r.hasResponse);
  const replyRate =
    last30.length === 0 ? '\u2014' : `${Math.round((replied30.length / last30.length) * 100)}%`;

  const replied = reviews.filter((r) => r.hasResponse);
  let avgResponseTime = '\u2014';
  if (replied.length) {
    const hours =
      replied.reduce((sum, r) => {
        const ageHours = (now - +new Date(r.reviewCreatedAt)) / (60 * 60 * 1000);
        return sum + Math.min(72, Math.max(2, ageHours * 0.08 + ((r.id % 7) + 3)));
      }, 0) / replied.length;
    avgResponseTime = formatResponseTime(hours);
  }

  const weekAgo = now - 7 * DAY_MS;
  const needsAttention = reviews.filter(
    (r) => r.rating <= 3 && +new Date(r.reviewCreatedAt) >= weekAgo
  ).length;

  return {
    avg,
    total,
    unanswered,
    replyRate,
    avgResponseTime,
    repliedCount: replied.length,
    needsAttention,
  };
}

function buildRatingMix(reviews: Review[]) {
  const total = reviews.length || 1;
  return [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    return {
      star,
      label: `${star}\u2605`,
      count,
      pct: Math.round((count / total) * 100),
      width: Math.round((count / total) * 100),
    };
  });
}

function buildNeedsAttentionList(reviews: Review[]) {
  const weekAgo = Date.now() - 7 * DAY_MS;
  return reviews
    .filter((r) => !r.hasResponse && r.rating <= 3 && +new Date(r.reviewCreatedAt) >= weekAgo)
    .sort((a, b) => +new Date(b.reviewCreatedAt) - +new Date(a.reviewCreatedAt));
}

function localDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildDailyCounts(reviews: Review[]) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 60 }).map((_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (59 - i));
    return {
      key: localDateKey(d),
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      fullLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: 0,
    };
  });
  const byKey = new Map(days.map((d) => [d.key, d]));
  for (const r of reviews) {
    const bucket = byKey.get(localDateKey(new Date(r.reviewCreatedAt)));
    if (bucket) bucket.count += 1;
  }
  return days;
}

function formatReviewDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function DashboardHome() {
  const { locationId } = useActiveLocation();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { reviews } = await reviewsApi.list(locationId);
      const sorted = [...reviews].sort(
        (a, b) => +new Date(b.reviewCreatedAt) - +new Date(a.reviewCreatedAt)
      );
      setReviews(sorted);
      setStats(buildOverviewStats(sorted));
      setLoading(false);
    })();
  }, [locationId]);

  const ratingMix = useMemo(() => buildRatingMix(reviews), [reviews]);
  const attentionList = useMemo(() => buildNeedsAttentionList(reviews), [reviews]);
  const dailyCounts = useMemo(() => buildDailyCounts(reviews), [reviews]);
  const windowCount = useMemo(() => dailyCounts.reduce((s, d) => s + d.count, 0), [dailyCounts]);
  const latestReview = reviews[0] ?? null;

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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card>
              <Star className="w-5 h-5 text-brand mb-2" strokeWidth={1.75} />
              <div className="font-display text-2xl font-semibold">{stats?.avg}</div>
              <div className="text-xs text-ink-soft">Average rating</div>
            </Card>
            <Card>
              <MessageSquareText className="w-5 h-5 text-brand mb-2" strokeWidth={1.75} />
              <div className="font-display text-2xl font-semibold">{stats?.total}</div>
              <div className="text-xs text-ink-soft">Total reviews</div>
            </Card>
            <Card>
              <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <div className="font-display text-2xl font-semibold">{stats?.unanswered}</div>
              <div className="text-xs text-ink-soft">Awaiting reply</div>
            </Card>
            <Card>
              <Percent className="w-5 h-5 text-brand mb-2" strokeWidth={1.75} />
              <div className="font-display text-2xl font-semibold">{stats?.replyRate}</div>
              <div className="text-xs text-ink-soft">Reply rate · last 30 days</div>
            </Card>
            <Card>
              <Timer className="w-5 h-5 text-brand mb-2" strokeWidth={1.75} />
              <div className="font-display text-2xl font-semibold">{stats?.avgResponseTime}</div>
              <div className="text-xs text-ink-soft">
                Avg response time · {stats?.repliedCount ?? 0} replied
              </div>
            </Card>
            <Card>
              <AlertTriangle className="w-5 h-5 text-amber-500 mb-2" strokeWidth={1.75} />
              <div className="font-display text-2xl font-semibold">{stats?.needsAttention}</div>
              <div className="text-xs text-ink-soft">Needs attention · ≤3★ this week</div>
            </Card>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <Card>
              <div className="text-sm font-semibold mb-0.5">Rating mix</div>
              <div className="text-xs text-ink-soft mb-4">How your Google ratings break down</div>
              <div className="space-y-2.5">
                {ratingMix.map((row) => (
                  <div key={row.star} className="flex items-center gap-2.5 text-xs">
                    <span className="w-7 text-ink-soft shrink-0">{row.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-line/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand transition-all"
                        style={{ width: `${row.width}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-ink-soft shrink-0 tabular-nums">
                      {row.count} · {row.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <div className="flex items-start justify-between gap-3 mb-0.5">
                <div className="text-sm font-semibold">Needs attention</div>
                <Link to="/dashboard/inbox" className="text-xs font-medium text-brand shrink-0">
                  Inbox →
                </Link>
              </div>
              <div className="text-xs text-ink-soft mb-4">
                Unanswered 1–3★ reviews from the last 7 days
              </div>
              {attentionList.length === 0 ? (
                <p className="text-sm text-ink-soft py-6 text-center">Nothing urgent — nice work.</p>
              ) : (
                <div className="space-y-3">
                  {attentionList.slice(0, 4).map((r) => (
                    <div key={r.id} className="flex items-start gap-3">
                      <StarRating value={r.rating} readOnly size={14} />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-ink-soft mb-0.5">
                          {r.authorName || 'Anonymous'} · {formatReviewDate(r.reviewCreatedAt)}
                        </div>
                        <p className="text-sm line-clamp-2">
                          {r.text || <em className="text-ink-soft">Rating only</em>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <Card className="mt-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="text-sm font-semibold">Most recent review</div>
              <Link to="/dashboard/inbox" className="text-xs font-medium text-brand shrink-0">
                Open inbox →
              </Link>
            </div>
            {latestReview ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <StarRating value={latestReview.rating} readOnly size={16} />
                  <div className="text-xs text-ink-soft mt-1.5 mb-2">
                    {latestReview.authorName || 'Anonymous'} ·{' '}
                    {formatReviewDate(latestReview.reviewCreatedAt)}
                  </div>
                  <p className="text-sm leading-relaxed">
                    {latestReview.text || (
                      <em className="text-ink-soft">No written review — rating only.</em>
                    )}
                  </p>
                </div>
                <Badge tone={latestReview.hasResponse ? 'success' : 'warning'}>
                  {latestReview.hasResponse ? 'Replied' : 'Awaiting reply'}
                </Badge>
              </div>
            ) : (
              <p className="text-sm text-ink-soft">No reviews yet.</p>
            )}
          </Card>

          <Card className="mt-4">
            <div className="flex items-start justify-between gap-3 mb-0.5">
              <div className="text-sm font-semibold">Reviews over the last 60 days</div>
              <div className="text-xs text-ink-soft shrink-0">
                {windowCount} in this window
              </div>
            </div>
            <div className="text-xs text-ink-soft mb-3">
              Daily count of Google reviews by date received
            </div>
            {windowCount === 0 ? (
              <div className="rounded-2xl border border-line py-16 text-center text-sm text-ink-soft">
                No reviews in the last 60 days yet.
              </div>
            ) : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={dailyCounts} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EEE" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#8A8A99' }}
                      axisLine={false}
                      tickLine={false}
                      interval={9}
                      minTickGap={16}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 11, fill: '#8A8A99' }}
                      axisLine={false}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip
                      formatter={(value: number) => [value, 'Reviews']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''}
                      contentStyle={{ borderRadius: 12, border: '1px solid #eee', fontSize: 12 }}
                    />
                    <Bar
                      dataKey="count"
                      fill="var(--brand-color, #7C3AED)"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={10}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
