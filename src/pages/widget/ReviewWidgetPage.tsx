import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Star } from 'lucide-react';
import { getDb, delay } from '../../lib/mockDb';

interface WidgetData {
  businessName: string;
  averageRating: number | null;
  totalReviews: number;
  reviews: { rating: number; text: string | null; authorName: string | null; date: string }[];
}

export default function ReviewWidgetPage() {
  const { locationId } = useParams();
  const [params] = useSearchParams();
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState(true);

  const minRating = Number(params.get('minRating') || '4'); // defaults to showing 4-5★, a normal "wall of love" pattern
  const limit = Number(params.get('limit') || '6');

  useEffect(() => {
    // Demo mode: read straight from the local in-browser store instead of
    // hitting a real API (this page is normally embedded via <iframe> on an
    // external site, so it can't rely on the dashboard's auth token).
    const db = getDb();
    const locId = Number(locationId);
    const business = Object.values(db.businesses).find((b: any) => {
      const loc = db.locations[locId];
      return loc && loc.businessId === b.id;
    }) as any;
    const matching = db.reviews.filter((r) => r.locationId === locId && r.rating >= minRating).slice(0, limit);
    const totalReviews = db.reviews.filter((r) => r.locationId === locId).length;
    const averageRating = totalReviews
      ? +(db.reviews.filter((r) => r.locationId === locId).reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1)
      : null;
    delay({
      businessName: business?.name || 'Demo Business',
      averageRating,
      totalReviews,
      reviews: matching.map((r) => ({ rating: r.rating, text: r.text, authorName: r.authorName, date: r.reviewCreatedAt })),
    }).then(setData).finally(() => setLoading(false));
  }, [locationId, minRating, limit]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-400 font-sans">Loading reviews...</div>;
  }

  if (!data || data.reviews.length === 0) {
    return <div className="p-6 text-sm text-gray-400 font-sans">No reviews to show yet.</div>;
  }

  return (
    <div className="p-4 font-sans bg-white">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-semibold text-lg">{data.businessName}</span>
        {data.averageRating && (
          <span className="text-sm text-gray-500">
            {data.averageRating} ★ ({data.totalReviews} reviews)
          </span>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.reviews.map((r, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3">
            <div className="flex gap-0.5 mb-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className="w-3.5 h-3.5" fill={n <= r.rating ? '#F5B301' : 'transparent'} stroke={n <= r.rating ? '#F5B301' : '#D1D5DB'} />
              ))}
            </div>
            {r.text && <p className="text-sm text-gray-700 leading-relaxed mb-1.5">{r.text}</p>}
            <p className="text-xs text-gray-400">{r.authorName || 'Customer'}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-gray-300 mt-3 text-right">Reviews via {window.location.hostname}</p>
    </div>
  );
}
