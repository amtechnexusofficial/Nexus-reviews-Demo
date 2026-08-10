import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, ExternalLink, ImageIcon, Newspaper, RefreshCw } from 'lucide-react';
import { Card, EmptyState, Badge } from '../../components/ui';
import { Button } from '../../components/Button';
import {
  postsApi,
  publishApi,
  SocialPost,
  SocialPostPlatform,
  PostComment,
} from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';

function startOfDay(isoDate: string) {
  const d = new Date(`${isoDate}T00:00:00`);
  return Number.isNaN(+d) ? null : d;
}

function endOfDay(isoDate: string) {
  const d = new Date(`${isoDate}T23:59:59.999`);
  return Number.isNaN(+d) ? null : d;
}

function postMatchesFilters(
  post: SocialPost,
  platform: string,
  dateFrom: string,
  dateTo: string
) {
  if (platform !== 'all') {
    const hasPlatform = (post.platforms || []).some((p) => p.platform === platform);
    if (!hasPlatform) return false;
  }
  const created = +new Date(post.created_at);
  if (Number.isNaN(created)) return false;
  if (dateFrom) {
    const from = startOfDay(dateFrom);
    if (from && created < +from) return false;
  }
  if (dateTo) {
    const to = endOfDay(dateTo);
    if (to && created > +to) return false;
  }
  return true;
}

const PLATFORM_LABELS: Record<string, string> = {
  google_business: 'Google Business',
  instagram: 'Instagram',
  facebook: 'Facebook',
  twitter: 'Twitter / X',
  linkedin: 'LinkedIn',
  threads: 'Threads',
  pinterest: 'Pinterest',
  bluesky: 'Bluesky',
  telegram: 'Telegram',
};

const STAT_LABELS: Record<string, string> = {
  impressions: 'Impressions',
  likes: 'Likes',
  comments: 'Comments',
  saved: 'Saved',
  profile_visits: 'Profile visits',
  follows: 'Follows',
  shares: 'Shares',
  clicks: 'Clicks',
  retweets: 'Retweets',
  quotes: 'Quotes',
  replies: 'Replies',
  reposts: 'Reposts',
  outbound_clicks: 'Outbound clicks',
};

type PostStats = {
  totalImpressions: number;
  metricKeys: string[];
  series: { recordedAt: string; stats: Record<string, number> }[];
  platforms: {
    profileId: string;
    platform: string;
    stats: Record<string, number>;
    recordedAt: string | null;
    records?: { stats: Record<string, number>; recordedAt: string }[];
  }[];
};

function formatDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeTick(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso;
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'brand' {
  const s = status.toLowerCase();
  if (s.includes('publish') || s === 'processed' || s === 'active') return 'success';
  if (s.includes('fail') || s.includes('error')) return 'danger';
  if (s.includes('schedul') || s.includes('pending') || s.includes('process')) return 'warning';
  return 'neutral';
}

function mediaUrl(m: { url?: string | null; source_url?: string | null }) {
  return m.url || m.source_url || '';
}

function latestTotals(stats: PostStats | null): Record<string, number> {
  if (!stats) return {};
  if (stats.series.length > 0) return stats.series[stats.series.length - 1].stats;
  const totals: Record<string, number> = {};
  for (const p of stats.platforms) {
    for (const [k, v] of Object.entries(p.stats || {})) {
      if (typeof v === 'number') totals[k] = (totals[k] || 0) + v;
    }
  }
  return totals;
}

function StatsOverTimeChart({
  series,
  metric,
}: {
  series: { recordedAt: string; stats: Record<string, number> }[];
  metric: string;
}) {
  const width = 640;
  const height = 260;
  const pad = { top: 16, right: 16, bottom: 36, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const points = series.map((s) => ({
    t: +new Date(s.recordedAt),
    v: Number(s.stats[metric]) || 0,
    label: formatTimeTick(s.recordedAt),
  }));

  const maxV = Math.max(1, ...points.map((p) => p.v));
  const yMax = Math.ceil(maxV);
  const yTicks = [0, Math.round(yMax / 3), Math.round((2 * yMax) / 3), yMax].filter(
    (v, i, arr) => i === 0 || v !== arr[i - 1]
  );

  if (points.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center border border-line rounded-xl bg-paper/40">
        <p className="text-sm text-ink-soft">No snapshots yet for this metric.</p>
      </div>
    );
  }

  const minT = points[0].t;
  const maxT = points[points.length - 1].t || minT + 1;
  const xAt = (t: number) => pad.left + ((t - minT) / (maxT - minT || 1)) * innerW;
  const yAt = (v: number) => pad.top + innerH - (v / yMax) * innerH;

  const path =
    points.length === 1
      ? `M ${xAt(points[0].t)} ${yAt(points[0].v)}`
      : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(p.t)} ${yAt(p.v)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64" role="img" aria-label={`${metric} over time`}>
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={pad.left}
            x2={width - pad.right}
            y1={yAt(tick)}
            y2={yAt(tick)}
            stroke="currentColor"
            className="text-line"
            strokeWidth={1}
          />
          <text x={pad.left - 8} y={yAt(tick) + 3} textAnchor="end" className="fill-ink-soft" fontSize={10}>
            {tick}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="currentColor" className="text-brand" strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={xAt(p.t)} cy={yAt(p.v)} r={3.5} className="fill-brand" />
      ))}
      <text x={pad.left} y={height - 10} className="fill-ink-soft" fontSize={10}>
        {points[0].label}
      </text>
      {points.length > 1 && (
        <text x={width - pad.right} y={height - 10} textAnchor="end" className="fill-ink-soft" fontSize={10}>
          {points[points.length - 1].label}
        </text>
      )}
    </svg>
  );
}

function CommentTree({ comments }: { comments: PostComment[] }) {
  if (!comments.length) {
    return <p className="text-xs text-ink-soft">No comments yet.</p>;
  }
  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <div key={c.id} className="border border-line rounded-lg p-2.5 bg-paper/60">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-xs font-medium text-ink">{c.author_name || 'Commenter'}</p>
            <p className="text-[10px] text-ink-soft">{formatDate(c.created_at)}</p>
          </div>
          <p className="text-xs text-ink whitespace-pre-wrap">{c.body || '—'}</p>
          {c.replies && c.replies.length > 0 && (
            <div className="mt-2 ml-3 space-y-2 border-l border-line pl-2.5">
              {c.replies.map((r) => (
                <div key={r.id}>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <p className="text-[11px] font-medium">{r.author_name || 'Reply'}</p>
                    <p className="text-[10px] text-ink-soft">{formatDate(r.created_at)}</p>
                  </div>
                  <p className="text-[11px] text-ink-soft whitespace-pre-wrap">{r.body || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PlatformStats({
  platform,
  stats,
}: {
  platform: string;
  stats: Record<string, number>;
}) {
  const entries = Object.entries(stats).filter(([, v]) => typeof v === 'number');
  if (!entries.length) {
    return <p className="text-xs text-ink-soft">No stats yet for {PLATFORM_LABELS[platform] || platform}.</p>;
  }
  return (
    <div>
      <p className="text-xs font-semibold mb-1.5">{PLATFORM_LABELS[platform] || platform}</p>
      <div className="grid grid-cols-2 gap-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="rounded-lg border border-line bg-paper/50 px-2 py-1.5">
            <p className="text-[10px] text-ink-soft">{STAT_LABELS[key] || key}</p>
            <p className="text-sm font-semibold tabular-nums">{value.toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PostsPage() {
  const { locationId } = useActiveLocation();
  const { showError } = useToast();

  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPost, setDetailPost] = useState<SocialPost | null>(null);
  const [stats, setStats] = useState<PostStats | null>(null);
  const [commentsByPlatform, setCommentsByPlatform] = useState<
    { platform: string; comments: PostComment[]; error?: string }[]
  >([]);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [chartMetric, setChartMetric] = useState('impressions');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [connectedPlatforms, setConnectedPlatforms] = useState<string[]>([]);

  async function loadPosts(nextPage = 0) {
    if (!locationId) return;
    setLoadingList(true);
    setListError(null);
    try {
      const res = await postsApi.list(locationId, nextPage);
      setPosts(res.posts || []);
      setTotal(res.total || 0);
      setPage(res.page || nextPage);
    } catch (e: any) {
      setPosts([]);
      setListError(e.message || 'Could not load posts.');
    } finally {
      setLoadingList(false);
    }
  }

  async function loadConnectedPlatforms() {
    if (!locationId) return;
    try {
      const { profiles } = await publishApi.connections(locationId);
      const platforms = [
        ...new Set(
          (profiles || [])
            .filter((p) => p.status === 'active')
            .map((p) => p.platform)
            .filter(Boolean)
        ),
      ];
      setConnectedPlatforms(platforms);
    } catch {
      setConnectedPlatforms([]);
    }
  }

  async function loadDetail(postId: string) {
    if (!locationId) return;
    setDetailLoading(true);
    try {
      const res = await postsApi.detail(locationId, postId);
      setDetailPost(res.post);
      setStats(res.stats);
      setCommentsByPlatform(res.commentsByPlatform || []);
      const keys = res.stats?.metricKeys || [];
      setChartMetric(keys.includes('impressions') ? 'impressions' : keys[0] || 'impressions');
    } catch (e: any) {
      setDetailPost(null);
      setStats(null);
      setCommentsByPlatform([]);
      showError(e.message || 'Could not load that post.');
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    if (locationId) {
      setActivePostId(null);
      setDetailPost(null);
      setShowAnalytics(false);
      setPlatformFilter('all');
      setDateFrom('');
      setDateTo('');
      loadPosts(0);
      loadConnectedPlatforms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  useEffect(() => {
    if (activePostId) {
      setShowAnalytics(false);
      loadDetail(activePostId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePostId]);

  const platformOptions = useMemo(() => {
    const fromPosts = posts.flatMap((p) => (p.platforms || []).map((x) => x.platform));
    return [...new Set([...connectedPlatforms, ...fromPosts].filter(Boolean))].sort((a, b) =>
      (PLATFORM_LABELS[a] || a).localeCompare(PLATFORM_LABELS[b] || b)
    );
  }, [connectedPlatforms, posts]);

  const filteredPosts = useMemo(
    () => posts.filter((p) => postMatchesFilters(p, platformFilter, dateFrom, dateTo)),
    [posts, platformFilter, dateFrom, dateTo]
  );

  const filtersActive = platformFilter !== 'all' || !!dateFrom || !!dateTo;

  useEffect(() => {
    if (loadingList) return;
    if (filteredPosts.length === 0) {
      if (activePostId) setActivePostId(null);
      setDetailPost(null);
      setStats(null);
      setCommentsByPlatform([]);
      return;
    }
    if (!activePostId || !filteredPosts.some((p) => p.id === activePostId)) {
      setActivePostId(filteredPosts[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredPosts, loadingList]);

  const groupedByDay = useMemo(() => {
    const groups: { label: string; items: SocialPost[] }[] = [];
    const map = new Map<string, SocialPost[]>();
    for (const post of filteredPosts) {
      const key = new Date(post.created_at).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(post);
    }
    for (const [label, items] of map) groups.push({ label, items });
    return groups;
  }, [filteredPosts]);

  const totals = useMemo(() => latestTotals(stats), [stats]);
  const metricKeys =
    stats?.metricKeys?.length
      ? stats.metricKeys
      : ['impressions', 'saved', 'likes', 'comments', 'profile_visits', 'follows'];

  const perPage = 20;
  const hasMore = (page + 1) * perPage < total;

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  if (showAnalytics && detailPost) {
    return (
      <div className="p-5 md:p-8 max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAnalytics(false)}
            className="w-9 h-9 rounded-full border border-line bg-white/70 flex items-center justify-center hover:bg-paper"
            aria-label="Back to post"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display text-2xl font-semibold">Post Analytics</h1>
              <Badge tone="neutral">{detailPost.id}</Badge>
            </div>
            <p className="text-xs text-ink-soft mt-0.5">{formatDate(detailPost.created_at)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {metricKeys.map((key) => (
            <Card key={key} className="!p-3">
              <p className="text-2xl font-display font-semibold tabular-nums">
                {(totals[key] || 0).toLocaleString()}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-ink-soft mt-1">
                {STAT_LABELS[key] || key}
              </p>
            </Card>
          ))}
        </div>

        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-sm">Stats Over Time</h2>
            <div className="flex flex-wrap gap-1.5">
              {metricKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setChartMetric(key)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                    chartMetric === key
                      ? 'bg-ink text-white border-ink'
                      : 'bg-paper text-ink-soft border-line hover:text-ink'
                  }`}
                >
                  {STAT_LABELS[key] || key}
                </button>
              ))}
            </div>
          </div>
          <StatsOverTimeChart series={stats?.series || []} metric={chartMetric} />
          <p className="text-[10px] text-ink-soft mt-2">
            Points are Postproxy snapshots (typically refreshed about once a day per network). A single point means
            only one snapshot has been recorded so far.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-5 md:p-8 max-w-6xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold">Posts</h1>
        <Button size="sm" variant="secondary" onClick={() => loadPosts(page)} loading={loadingList}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setPlatformFilter('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              platformFilter === 'all'
                ? 'bg-brand-soft text-brand border-transparent'
                : 'border-line text-ink-soft hover:text-ink'
            }`}
          >
            All platforms
          </button>
          {platformOptions.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatformFilter(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                platformFilter === p
                  ? 'bg-brand-soft text-brand border-transparent'
                  : 'border-line text-ink-soft hover:text-ink'
              }`}
            >
              {PLATFORM_LABELS[p] || p}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-soft font-semibold">From</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border border-line rounded-lg px-2.5 py-1.5 text-sm bg-white/70 focus:border-brand outline-none"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-wide text-ink-soft font-semibold">To</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className="border border-line rounded-lg px-2.5 py-1.5 text-sm bg-white/70 focus:border-brand outline-none"
            />
          </label>
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setPlatformFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs font-semibold text-ink-soft hover:text-ink pb-1.5"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {listError && (
        <div className="text-xs text-danger bg-red-50 border border-red-200 rounded-lg p-3">{listError}</div>
      )}

      {!loadingList && posts.length === 0 && !listError && (
        <EmptyState
          title="No posts yet"
          body="Publish from Content, then come back here to see performance and comments."
          action={
            <Link to="/dashboard/content" className="text-sm text-brand underline font-medium">
              Go to Content
            </Link>
          }
        />
      )}

      {!loadingList && posts.length > 0 && filteredPosts.length === 0 && (
        <EmptyState
          title="No posts match these filters"
          body="Try another platform or widen the date range."
          action={
            <button
              type="button"
              className="text-sm text-brand underline font-medium"
              onClick={() => {
                setPlatformFilter('all');
                setDateFrom('');
                setDateTo('');
              }}
            >
              Clear filters
            </button>
          }
        />
      )}

      {filteredPosts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)_minmax(0,300px)] gap-4 items-start">
          <Card className="!p-3 max-h-[70vh] overflow-y-auto">
            <p className="text-xs font-semibold text-ink-soft mb-2 px-1">
              {filtersActive
                ? `${filteredPosts.length} matching on this page`
                : `${total} posts`}
            </p>
            <div className="space-y-3">
              {groupedByDay.map((group) => (
                <div key={group.label}>
                  <p className="text-[10px] uppercase tracking-wide text-ink-soft font-semibold px-1 mb-1">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((post) => {
                      const thumb = post.media?.map(mediaUrl).find(Boolean);
                      const platforms = (post.platforms || []).map((p) => p.platform);
                      const active = activePostId === post.id;
                      return (
                        <button
                          key={post.id}
                          type="button"
                          onClick={() => setActivePostId(post.id)}
                          className={`w-full text-left rounded-xl p-2.5 border transition-colors ${
                            active
                              ? 'border-brand bg-brand-soft'
                              : 'border-transparent hover:bg-paper hover:border-line'
                          }`}
                        >
                          <div className="flex gap-2">
                            <div className="w-11 h-11 rounded-lg bg-paper border border-line flex items-center justify-center overflow-hidden shrink-0">
                              {thumb ? (
                                <img src={thumb} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <ImageIcon className="w-4 h-4 text-ink-soft" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-ink line-clamp-2 whitespace-pre-wrap">
                                {post.body?.trim() || '(no caption)'}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {platforms.slice(0, 3).map((p) => (
                                  <Badge key={p} tone="neutral">
                                    {PLATFORM_LABELS[p] || p}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-[10px] text-ink-soft mt-1">{formatDate(post.created_at)}</p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3 px-1">
              <Button size="sm" variant="secondary" disabled={page <= 0 || loadingList} onClick={() => loadPosts(page - 1)}>
                Prev
              </Button>
              <Button size="sm" variant="secondary" disabled={!hasMore || loadingList} onClick={() => loadPosts(page + 1)}>
                Next
              </Button>
            </div>
          </Card>

          <Card className="min-h-[420px]">
            {detailLoading && <p className="text-sm text-ink-soft">Loading post…</p>}
            {!detailLoading && !detailPost && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Newspaper className="w-8 h-8 text-ink-soft mb-2" />
                <p className="text-sm text-ink-soft">Select a post to see its content and media.</p>
              </div>
            )}
            {!detailLoading && detailPost && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(detailPost.status)}>{detailPost.status}</Badge>
                  <p className="text-xs text-ink-soft">{formatDate(detailPost.created_at)}</p>
                </div>
                <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
                  {detailPost.body?.trim() || '(no caption)'}
                </p>
                {detailPost.media && detailPost.media.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {detailPost.media.map((m) => {
                      const src = mediaUrl(m);
                      if (!src) return null;
                      const isVideo = (m.content_type || '').startsWith('video/');
                      return (
                        <div key={m.id} className="rounded-xl border border-line overflow-hidden bg-paper">
                          {isVideo ? (
                            <video src={src} controls className="w-full max-h-72 object-contain bg-black" />
                          ) : (
                            <img src={src} alt="" className="w-full max-h-72 object-cover" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {detailPost.platforms && detailPost.platforms.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-line">
                    <p className="text-xs font-semibold">Published to</p>
                    {detailPost.platforms.map((p: SocialPostPlatform) => (
                      <div key={p.platform} className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{PLATFORM_LABELS[p.platform] || p.platform}</span>
                          <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                        </div>
                        {p.permalink && (
                          <a
                            href={p.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand inline-flex items-center gap-1"
                          >
                            Open <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>

          <div className="space-y-4">
            <Card>
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="text-xs font-semibold">Performance</p>
                <button
                  type="button"
                  onClick={() => setShowAnalytics(true)}
                  disabled={detailLoading || !detailPost}
                  className="text-[11px] font-semibold text-brand inline-flex items-center gap-1 disabled:opacity-40"
                >
                  <BarChart3 className="w-3.5 h-3.5" /> View analytics
                </button>
              </div>
              <p className="text-[10px] text-ink-soft mb-3">
                Snapshots update periodically from each network — not live second-by-second.
              </p>
              {detailLoading ? (
                <p className="text-xs text-ink-soft">Loading…</p>
              ) : (
                <>
                  <p className="text-[10px] text-ink-soft uppercase tracking-wide">Total impressions</p>
                  <p className="text-3xl font-display font-semibold tabular-nums mb-4">
                    {(stats?.totalImpressions || 0).toLocaleString()}
                  </p>
                  <div className="space-y-4">
                    {(stats?.platforms || []).map((p) => (
                      <PlatformStats key={p.platform} platform={p.platform} stats={p.stats} />
                    ))}
                    {!stats?.platforms?.length && (
                      <p className="text-xs text-ink-soft">No analytics snapshot yet for this post.</p>
                    )}
                  </div>
                </>
              )}
            </Card>

            <Card>
              <p className="text-xs font-semibold mb-3">Comments</p>
              {detailLoading ? (
                <p className="text-xs text-ink-soft">Loading…</p>
              ) : commentsByPlatform.length === 0 ? (
                <p className="text-xs text-ink-soft">No comment threads for this post.</p>
              ) : (
                <div className="space-y-4 max-h-[40vh] overflow-y-auto">
                  {commentsByPlatform.map((block) => (
                    <div key={block.platform}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft mb-2">
                        {PLATFORM_LABELS[block.platform] || block.platform}
                      </p>
                      {block.error ? (
                        <p className="text-xs text-warning">{block.error}</p>
                      ) : (
                        <CommentTree comments={block.comments} />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
