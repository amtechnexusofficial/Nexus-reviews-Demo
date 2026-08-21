import { useEffect, useState } from 'react';
import { Trash2, RefreshCw, Link2, ChevronDown } from 'lucide-react';
import { Card, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { competitorsApi, placesApi, Competitor } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';

export default function CompetitorsPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess, showError } = useToast();
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [yourStats, setYourStats] = useState<{ averageRating: number; reviewCount: number } | null>(null);

  // Link-paste flow (primary path)
  const [mapsUrl, setMapsUrl] = useState('');
  const [addingFromLink, setAddingFromLink] = useState(false);

  // Manual entry (fallback)
  const [showManual, setShowManual] = useState(false);
  const [name, setName] = useState('');
  const [rating, setRating] = useState('');
  const [reviewCount, setReviewCount] = useState('');
  const [adding, setAdding] = useState(false);

  const [placesConfigured, setPlacesConfigured] = useState(false);
  const [refreshingId, setRefreshingId] = useState<number | null>(null);

  useEffect(() => {
    placesApi.status().then((s) => setPlacesConfigured(s.configured));
  }, []);

  async function load() {
    if (!locationId) return;
    const [{ competitors }, comparison] = await Promise.all([
      competitorsApi.list(locationId),
      competitorsApi.comparison(locationId),
    ]);
    setCompetitors(competitors);
    setYourStats(comparison.you);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function addFromLink() {
    if (!locationId || !mapsUrl.trim()) return;
    setAddingFromLink(true);
    try {
      const res = await competitorsApi.createFromLink({ locationId, mapsUrl });
      if (res.error) {
        showError(res.error);
      } else {
        showSuccess(`Added ${res.competitor.name}.`);
        setMapsUrl('');
        await load();
      }
    } catch (e: any) {
      showError(e.message || 'Could not read that link — try the manual option below.');
    } finally {
      setAddingFromLink(false);
    }
  }

  async function addCompetitor() {
    if (!locationId || !name.trim()) return;
    setAdding(true);
    try {
      await competitorsApi.create({
        locationId,
        name,
        rating: rating ? Number(rating) : undefined,
        reviewCount: reviewCount ? Number(reviewCount) : undefined,
      });
      setName('');
      setRating('');
      setReviewCount('');
      await load();
      showSuccess('Competitor added.');
    } finally {
      setAdding(false);
    }
  }

  async function refresh(id: number) {
    setRefreshingId(id);
    try {
      const res = await placesApi.refreshCompetitor(id);
      await load();
      showSuccess(res.refreshed ? 'Competitor data refreshed.' : 'No matching place found on Google.');
    } catch {
      showError('Refresh failed — try again in a moment.');
    } finally {
      setRefreshingId(null);
    }
  }

  async function remove(id: number) {
    await competitorsApi.remove(id);
    await load();
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-1">Competitors</h1>
      <p className="text-sm text-ink-soft mb-4">Paste their Google Maps link — we'll pull their rating and review count.</p>

      {!placesConfigured && (
        <p className="text-xs text-warning bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-4">
          Google Places isn't configured yet — add GOOGLE_PLACES_API_KEY to enable automatic lookup. Manual entry still works below.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <div className="text-xs text-ink-soft mb-1">You</div>
          <div className="font-display text-2xl font-semibold">{yourStats?.averageRating ?? '—'} ★</div>
          <div className="text-xs text-ink-soft">{yourStats?.reviewCount ?? 0} reviews</div>
        </Card>
      </div>

      {placesConfigured && (
        <Card className="mb-4">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-1.5">
            <Link2 className="w-4 h-4" /> Paste their Google Maps link
          </h2>
          <div className="flex gap-2">
            <input
              value={mapsUrl}
              onChange={(e) => setMapsUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/... or full Google Maps link"
              className="flex-1 border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none"
            />
            <Button size="sm" onClick={addFromLink} loading={addingFromLink} disabled={!mapsUrl.trim()}>
              Add
            </Button>
          </div>
        </Card>
      )}

      <button
        onClick={() => setShowManual((v) => !v)}
        className="flex items-center gap-1 text-xs text-ink-soft mb-4"
      >
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showManual ? 'rotate-180' : ''}`} />
        {placesConfigured ? "Link didn't work? Enter manually" : 'Add manually'}
      </button>

      {showManual && (
        <Card className="mb-6">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Business name"
              className="col-span-2 border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none"
            />
            <input
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              placeholder="Rating (e.g. 4.3)"
              type="number"
              step="0.1"
              className="border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none"
            />
            <input
              value={reviewCount}
              onChange={(e) => setReviewCount(e.target.value)}
              placeholder="Review count"
              type="number"
              className="border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none"
            />
          </div>
          <Button size="sm" onClick={addCompetitor} loading={adding} disabled={!name.trim()}>
            Add competitor
          </Button>
        </Card>
      )}

      {competitors.length === 0 ? (
        <EmptyState title="No competitors tracked yet" body="Paste a Google Maps link above to start comparing." />
      ) : (
        <div className="space-y-2">
          {competitors.map((comp) => (
            <Card key={comp.id} className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{comp.name}</div>
                  <div className="text-xs text-ink-soft">
                    {comp.rating != null ? Number(comp.rating).toFixed(1) : '—'} ★ · {comp.reviewCount ?? '—'} reviews
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {placesConfigured && (
                    <button
                      onClick={() => refresh(comp.id)}
                      disabled={refreshingId === comp.id}
                      className="text-ink-soft hover:text-brand disabled:opacity-40"
                      title="Refresh from Google"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshingId === comp.id ? 'animate-spin' : ''}`} />
                    </button>
                  )}
                  <button onClick={() => remove(comp.id)} className="text-ink-soft hover:text-danger">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
