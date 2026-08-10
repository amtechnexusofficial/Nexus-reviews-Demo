import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, Send } from 'lucide-react';
import { Card, Badge, StarRating, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { reviewsApi, Review } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';

type Filter = 'all' | 'unanswered';

export default function InboxPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess, showError } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [drafting, setDrafting] = useState<number | null>(null);
  const [draftText, setDraftText] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    const { reviews } = await reviewsApi.list(locationId);
    setReviews(reviews.sort((a, b) => +new Date(b.reviewCreatedAt) - +new Date(a.reviewCreatedAt)));
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function sync() {
    if (!locationId) return;
    setSyncing(true);
    try {
      const { synced } = await reviewsApi.sync(locationId);
      await load();
      showSuccess(`Synced ${synced} review${synced === 1 ? '' : 's'} from Google.`);
    } catch (err: any) {
      showError(err.message?.includes('400') ? 'Connect Google Business in Connections first.' : 'Sync failed — try again in a moment.');
    } finally {
      setSyncing(false);
    }
  }

  async function draftReply(review: Review) {
    setDrafting(review.id);
    try {
      const { draft } = await reviewsApi.draftReply(review.id);
      setDraftText((prev) => ({ ...prev, [review.id]: draft }));
    } finally {
      setDrafting(null);
    }
  }

  async function sendReply(review: Review) {
    const text = draftText[review.id];
    if (!text) return;
    setSending(review.id);
    try {
      await reviewsApi.reply(review.id, text);
      await load();
    } finally {
      setSending(null);
    }
  }

  const filtered = filter === 'unanswered' ? reviews.filter((r) => !r.hasResponse) : reviews;

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  return (
    <div className="p-5 md:p-8 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold">Google Reviews</h1>
        <Button variant="secondary" size="sm" onClick={sync} loading={syncing}>
          <RefreshCw className="w-3.5 h-3.5" /> Sync
        </Button>
      </div>
      <p className="text-xs text-ink-soft mb-5">
        Google review data refreshes on Postproxy's own schedule (twice daily) — Sync pulls whatever's
        currently available, it doesn't force an instant re-check of Google itself.
      </p>

      <div className="flex gap-2 mb-5">
        {(['all', 'unanswered'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
              filter === f ? 'bg-brand-soft text-brand border-transparent' : 'border-line text-ink-soft'
            }`}
          >
            {f === 'all' ? 'All' : 'Awaiting reply'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading...</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body="Reviews will show up here once you connect Google Business in Connections and sync, or once customers use your review kiosk."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <StarRating value={r.rating} readOnly size={16} />
                  <div className="text-xs text-ink-soft mt-1">
                    {r.authorName || 'Anonymous'} · {new Date(r.reviewCreatedAt).toLocaleDateString()}
                  </div>
                </div>
                <Badge tone={r.hasResponse ? 'success' : 'warning'}>
                  {r.hasResponse ? 'Replied' : 'Awaiting reply'}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed mb-3">{r.text || <em className="text-ink-soft">Star rating only, no written review.</em>}</p>

              {r.hasResponse ? (
                <div className="bg-paper rounded-lg p-3 text-sm text-ink-soft border border-line">
                  <span className="font-medium text-ink">Your reply: </span>
                  {r.responseText}
                </div>
              ) : (
                <div>
                  {draftText[r.id] ? (
                    <div>
                      <textarea
                        value={draftText[r.id]}
                        onChange={(e) => setDraftText((prev) => ({ ...prev, [r.id]: e.target.value }))}
                        rows={3}
                        className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none resize-none"
                      />
                      <Button size="sm" onClick={() => sendReply(r)} loading={sending === r.id}>
                        <Send className="w-3.5 h-3.5" /> Send reply
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => draftReply(r)} loading={drafting === r.id}>
                      <Sparkles className="w-3.5 h-3.5" /> Draft AI reply
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
