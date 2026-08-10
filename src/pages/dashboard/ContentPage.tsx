import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, Sparkles, Link2, Send, Upload } from 'lucide-react';
import { Card, Badge } from '../../components/ui';
import { Button } from '../../components/Button';
import { contentApi, publishApi, aiContentApi } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';
import ImageStudio from './ImageStudio';

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

const MEDIA_LIMITS: Record<string, { max: number; note: string }> = {
  instagram: { max: 10, note: '2-10 images = automatic carousel. 1 image = single post.' },
  twitter: { max: 4, note: 'Up to 4 images.' },
  linkedin: { max: 20, note: 'Up to 20 images.' },
  threads: { max: 20, note: 'Up to 20 images.' },
  telegram: { max: 10, note: 'Up to 10 images.' },
  bluesky: { max: 4, note: 'Up to 4 images.' },
  facebook: { max: 10, note: 'Multiple images supported.' },
  pinterest: { max: 1, note: 'Pinterest takes exactly 1 image per pin.' },
};

const GOOGLE_FORMATS = [
  { key: 'standard', label: 'Update' },
  { key: 'event', label: 'Event' },
  { key: 'offer', label: 'Offer' },
] as const;

interface Connection {
  id: string;
  name: string;
  platform: string;
  status: string;
}

export default function ContentPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess, showError } = useToast();

  const [postproxyConfigured, setPostproxyConfigured] = useState(false);
  const [supportedPlatforms, setSupportedPlatforms] = useState<string[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  // Which tab is active — 'all' (consolidated, pick any combo) or a single platform key
  const [activeTab, setActiveTab] = useState<string>('all');

  // Generic composer (used by both "All Platforms" and single-platform tabs)
  const [composerText, setComposerText] = useState('');
  const [composerMedia, setComposerMedia] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [composerScheduleTime, setComposerScheduleTime] = useState('');
  const [showGenericStudio, setShowGenericStudio] = useState(false);

  // Google Business composer (its own tab, dedicated fields)
  const [gbFormat, setGbFormat] = useState<'standard' | 'event' | 'offer'>('standard');
  const [gbBody, setGbBody] = useState('');
  const [gbMediaUrl, setGbMediaUrl] = useState('');
  const [gbEventTitle, setGbEventTitle] = useState('');
  const [gbStartDate, setGbStartDate] = useState('');
  const [gbEndDate, setGbEndDate] = useState('');
  const [gbCoupon, setGbCoupon] = useState('');
  const [gbGeneratingDraft, setGbGeneratingDraft] = useState(false);
  const [gbPublishing, setGbPublishing] = useState(false);
  const [gbTheme, setGbTheme] = useState('');
  const [gbScheduleTime, setGbScheduleTime] = useState('');
  const [showGbStudio, setShowGbStudio] = useState(false);

  const [scheduledList, setScheduledList] = useState<any[]>([]);

  // Image generation quota (shared with ImageStudio)
  const [imageGenConfigured, setImageGenConfigured] = useState(false);
  const [imageEditConfigured, setImageEditConfigured] = useState(false);
  const [imageQuota, setImageQuota] = useState<{
    used: number;
    limit: number;
    plan: string;
    unlimited: boolean;
  } | null>(null);

  useEffect(() => {
    publishApi.status().then((s) => {
      setPostproxyConfigured(s.postproxyConfigured);
      setSupportedPlatforms(s.supportedPlatforms || []);
    });
    aiContentApi.imageStatus().then((s) => {
      setImageGenConfigured(s.configured);
      setImageEditConfigured(s.editConfigured);
    });
    aiContentApi.imageQuota().then(setImageQuota).catch(() => {});
  }, []);

  useEffect(() => {
    if (locationId) loadConnections();
    if (locationId) loadScheduled();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  // Keep selectedPlatforms in sync with the active tab — single-platform tabs
  // always publish to just that one platform, no picker needed.
  useEffect(() => {
    if (activeTab !== 'all' && activeTab !== 'google_business') {
      setSelectedPlatforms([activeTab]);
    }
  }, [activeTab]);

  async function loadConnections() {
    if (!locationId) return;
    try {
      const { profiles } = await publishApi.connections(locationId);
      setConnections(profiles);
    } catch {
      setConnections([]);
    }
  }

  function connectionFor(platform: string) {
    return connections.find((c) => c.platform === platform && c.status === 'active');
  }

  function togglePlatform(p: string) {
    setSelectedPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!locationId) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingImage(true);
    const uploadedUrls: string[] = [];
    try {
      for (const file of files) {
        const { url, error } = await aiContentApi.uploadImage(locationId, file);
        if (error) showError(error);
        else uploadedUrls.push(url);
      }
      if (uploadedUrls.length > 0) {
        setComposerMedia((prev) => (prev ? `${prev}, ${uploadedUrls.join(', ')}` : uploadedUrls.join(', ')));
        showSuccess(`${uploadedUrls.length} image${uploadedUrls.length > 1 ? 's' : ''} uploaded.`);
      }
    } catch (err: any) {
      showError(err.message || 'Upload failed.');
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function publishComposer() {
    if (!locationId || !composerText.trim() || selectedPlatforms.length === 0) return;
    const mediaUrls = composerMedia.trim() ? composerMedia.split(',').map((s) => s.trim()).filter(Boolean) : [];
    for (const p of selectedPlatforms) {
      const limit = MEDIA_LIMITS[p];
      if (limit && mediaUrls.length > limit.max) {
        showError(`${PLATFORM_LABELS[p]} allows up to ${limit.max} images — you have ${mediaUrls.length}.`);
        return;
      }
    }
    setPublishing(true);
    try {
      const res = await publishApi.publish({
        locationId,
        body: composerText,
        platforms: selectedPlatforms,
        mediaUrls: mediaUrls.length ? mediaUrls : undefined,
        scheduledFor: composerScheduleTime ? new Date(composerScheduleTime).toISOString() : undefined,
        timezone: composerScheduleTime ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
      });
      if (res.scheduled) {
        showSuccess(`Scheduled for ${new Date(composerScheduleTime).toLocaleString()}.`);
        setComposerText('');
        setComposerMedia('');
        setComposerScheduleTime('');
        loadScheduled();
      } else if (res.published) {
        showSuccess(`Published to ${selectedPlatforms.map((p) => PLATFORM_LABELS[p] || p).join(', ')}.`);
        setComposerText('');
        setComposerMedia('');
      } else {
        showError(res.error || 'Publish failed.');
      }
    } catch (e: any) {
      showError(e.message || 'Publish failed.');
    } finally {
      setPublishing(false);
    }
  }

  async function generateGbDraft() {
    if (!locationId || !gbTheme.trim()) return;
    setGbGeneratingDraft(true);
    try {
      const { draft } = await contentApi.googlePost({ locationId, theme: gbTheme });
      setGbBody(draft);
    } finally {
      setGbGeneratingDraft(false);
    }
  }

  async function loadScheduled() {
    if (!locationId) return;
    try {
      const { scheduled } = await publishApi.scheduled(locationId);
      setScheduledList(scheduled);
    } catch {
      // non-critical
    }
  }

  async function publishGoogle() {
    if (!locationId || !gbBody.trim()) return;
    setGbPublishing(true);
    try {
      const res = await publishApi.publishGooglePost({
        locationId,
        body: gbBody,
        format: gbFormat,
        mediaUrl: gbMediaUrl || undefined,
        eventTitle: gbFormat === 'event' || gbFormat === 'offer' ? gbEventTitle : undefined,
        eventStartDate: gbFormat === 'event' || gbFormat === 'offer' ? gbStartDate : undefined,
        eventEndDate: gbFormat === 'event' || gbFormat === 'offer' ? gbEndDate : undefined,
        offerCouponCode: gbFormat === 'offer' ? gbCoupon : undefined,
        scheduledFor: gbScheduleTime ? new Date(gbScheduleTime).toISOString() : undefined,
        timezone: gbScheduleTime ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
      });
      if (res.scheduled) {
        showSuccess(`Scheduled for ${new Date(gbScheduleTime).toLocaleString()}.`);
        setGbBody('');
        setGbMediaUrl('');
        setGbScheduleTime('');
        loadScheduled();
      } else if (res.published) {
        showSuccess('Published to Google Business.');
        setGbBody('');
        setGbMediaUrl('');
      } else {
        showError(res.error || 'Publish failed.');
      }
    } catch (e: any) {
      showError(e.message || 'Publish failed.');
    } finally {
      setGbPublishing(false);
    }
  }

  function refreshImageQuota() {
    aiContentApi.imageQuota().then(setImageQuota).catch(() => {});
  }

  // Embedded studio finalize handlers — each composer gets its own, feeding
  // directly into that composer's own state (no cross-tab routing needed
  // since the generic composer is already shared across all non-Google tabs,
  // same as its text/media fields already are).
  function finalizeIntoGenericComposer(imageUrl: string, caption: string) {
    if (caption.trim()) setComposerText(caption);
    if (imageUrl) {
      setComposerMedia((prev) => {
        const existing = prev
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (existing.includes(imageUrl)) return prev;
        return prev ? `${prev}, ${imageUrl}` : imageUrl;
      });
    }
    // Stay open after an image-only send so Caption can use the composer photo next.
    if (caption.trim()) setShowGenericStudio(false);
  }

  function finalizeIntoGbComposer(imageUrl: string, caption: string) {
    if (caption.trim()) setGbBody(caption);
    if (imageUrl && imageUrl !== gbMediaUrl) setGbMediaUrl(imageUrl);
    if (caption.trim()) setShowGbStudio(false);
  }

  if (!locationId) return null;

  const tabs = ['all', ...supportedPlatforms];

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold mb-1">Create Post</h1>
        <p className="text-sm text-ink-soft">
          Manage each platform on its own tab, or use "All Platforms" to post everywhere at once.
        </p>
      </div>

      {!postproxyConfigured && (
        <div className="text-xs text-warning bg-amber-50 border border-amber-200 rounded-lg p-3">
          Real publishing isn't connected yet — add <code>POSTPROXY_API_KEY</code> to enable it.
        </div>
      )}

      {postproxyConfigured && connections.filter((c) => c.status === 'active').length === 0 && (
        <div className="text-xs text-ink-soft bg-white/60 border border-line rounded-lg p-3">
          No platforms connected yet —{' '}
          <Link to="/dashboard/connections" className="text-brand underline font-medium">
            connect them in Connections
          </Link>{' '}
          first, then come back here to publish.
        </div>
      )}

      {/* ---------------- Platform tabs ---------------- */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold ${
            activeTab === 'all' ? 'bg-gradient-to-r from-brand to-brand-2 text-white' : 'bg-white/60 text-ink-soft'
          }`}
        >
          All Platforms
        </button>
        {tabs.slice(1).map((p) => {
          const connected = Boolean(connectionFor(p));
          return (
            <button
              key={p}
              onClick={() => setActiveTab(p)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-1.5 ${
                activeTab === p ? 'bg-gradient-to-r from-brand to-brand-2 text-white' : 'bg-white/60 text-ink-soft'
              }`}
            >
              {PLATFORM_LABELS[p] || p}
              {connected && <span className="w-1.5 h-1.5 rounded-full bg-success" />}
            </button>
          );
        })}
      </div>

      {/* ---------------- Tab content ---------------- */}

      {activeTab !== 'all' && activeTab !== 'google_business' && !connectionFor(activeTab) && (
        <Card>
          <p className="text-sm text-ink-soft mb-3">
            {PLATFORM_LABELS[activeTab]} isn't connected yet for this location.
          </p>
          <Link to="/dashboard/connections">
            <Button size="sm">
              <Link2 className="w-3.5 h-3.5" /> Connect in Connections
            </Button>
          </Link>
        </Card>
      )}

      {activeTab === 'google_business' && !connectionFor('google_business') && (
        <Card>
          <p className="text-sm text-ink-soft mb-3">Google Business isn't connected yet for this location.</p>
          <Link to="/dashboard/connections">
            <Button size="sm">
              <Link2 className="w-3.5 h-3.5" /> Connect in Connections
            </Button>
          </Link>
        </Card>
      )}

      {(activeTab === 'all' || (activeTab !== 'google_business' && connectionFor(activeTab))) && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">
              {activeTab === 'all' ? 'Compose for multiple platforms' : `Compose for ${PLATFORM_LABELS[activeTab]}`}
            </h2>
          </div>

          {activeTab === 'all' && (
            <div className="flex flex-wrap gap-2 mb-3">
              {supportedPlatforms
                .filter((p) => p !== 'google_business' && connectionFor(p))
                .map((p) => (
                  <button
                    key={p}
                    onClick={() => togglePlatform(p)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                      selectedPlatforms.includes(p) ? 'bg-brand-soft text-brand border-transparent' : 'border-line text-ink-soft'
                    }`}
                  >
                    {PLATFORM_LABELS[p]}
                  </button>
                ))}
              {connectionFor('google_business') && (
                <button
                  onClick={() => setActiveTab('google_business')}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-line text-ink-soft"
                >
                  Google Business →
                </button>
              )}
            </div>
          )}

          <textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            rows={4}
            placeholder="Write your post, or use AI Studio above..."
            className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none resize-none"
          />
          <input
            value={composerMedia}
            onChange={(e) => setComposerMedia(e.target.value)}
            placeholder="Image URL(s), comma-separated (works for every platform)"
            className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none"
          />
          <div className="mb-2">
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" />
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploadingImage}>
              <Upload className="w-3.5 h-3.5" /> Upload from device
            </Button>
          </div>

          {composerMedia.trim() && (
            <div className="mb-3">
              <div className="flex gap-2 flex-wrap mb-2">
                {composerMedia.split(',').map((u) => u.trim()).filter(Boolean).map((url, i) => (
                  <img key={i} src={url} alt={`Media ${i + 1}`} className="w-16 h-16 object-cover rounded-lg border border-line" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.2')} />
                ))}
              </div>
              {selectedPlatforms.map((p) => {
                const count = composerMedia.split(',').map((s) => s.trim()).filter(Boolean).length;
                const limit = MEDIA_LIMITS[p];
                if (!limit) return null;
                const overLimit = count > limit.max;
                return (
                  <p key={p} className={`text-xs ${overLimit ? 'text-danger' : 'text-ink-soft'}`}>
                    {PLATFORM_LABELS[p]}: {limit.note} {overLimit && `— you have ${count}, trim to ${limit.max}.`}
                  </p>
                );
              })}
            </div>
          )}

          <div className="mb-3">
            <label className="block text-xs text-ink-soft mb-1">Schedule for later (optional)</label>
            <input
              type="datetime-local"
              value={composerScheduleTime}
              onChange={(e) => setComposerScheduleTime(e.target.value)}
              className="border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
            />
          </div>

          <Button
            type="button"
            size="sm"
            variant={showGenericStudio ? 'secondary' : 'primary'}
            onClick={() => setShowGenericStudio((v) => !v)}
            className="mb-3"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {showGenericStudio ? 'Hide AI Studio' : 'Chat with AI for image + caption ideas'}
          </Button>

          {showGenericStudio && (
            <div className="mb-3">
              <ImageStudio
                locationId={locationId}
                platform={selectedPlatforms[0] || 'instagram'}
                composerImageUrl={
                  composerMedia
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .slice(-1)[0] || ''
                }
                imageGenConfigured={imageGenConfigured}
                imageEditConfigured={imageEditConfigured}
                imageQuota={imageQuota}
                onQuotaUsed={refreshImageQuota}
                onFinalize={finalizeIntoGenericComposer}
              />
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={publishComposer} loading={publishing} disabled={!composerText.trim() || selectedPlatforms.length === 0}>
              <Send className="w-3.5 h-3.5" /> {composerScheduleTime ? 'Schedule' : 'Publish'}
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'google_business' && connectionFor('google_business') && (
        <Card>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-semibold text-sm">Google Business post</h2>
          </div>
          <p className="text-xs text-ink-soft mb-3">
            Updates, events, and offers with coupon codes. Manage the Google location path in{' '}
            <Link to="/dashboard/connections" className="text-brand underline">Connections</Link>.
          </p>

          <div className="flex gap-2 mb-3">
            {GOOGLE_FORMATS.map((f) => (
              <button key={f.key} onClick={() => setGbFormat(f.key)} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${gbFormat === f.key ? 'bg-brand-soft text-brand border-transparent' : 'border-line text-ink-soft'}`}>
                {f.label}
              </button>
            ))}
          </div>

          <input value={gbTheme} onChange={(e) => setGbTheme(e.target.value)} placeholder="Theme for AI draft — e.g. 'weekend special'" className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none" />
          <Button size="sm" variant="secondary" onClick={generateGbDraft} loading={gbGeneratingDraft} disabled={!gbTheme.trim()}>
            <Sparkles className="w-3.5 h-3.5" /> Draft text
          </Button>

          <textarea value={gbBody} onChange={(e) => setGbBody(e.target.value)} rows={3} placeholder="Post text" className="w-full border border-line rounded-lg p-2.5 text-sm mt-3 mb-2 focus:border-brand outline-none resize-none" />

          <input value={gbMediaUrl} onChange={(e) => setGbMediaUrl(e.target.value)} placeholder="Photo URL (optional)" className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none" />
          {gbMediaUrl && <img src={gbMediaUrl} alt="GB media" className="w-16 h-16 object-cover rounded-lg border border-line mb-2" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.2')} />}

          {(gbFormat === 'event' || gbFormat === 'offer') && (
            <div className="space-y-2 mb-2">
              <input value={gbEventTitle} onChange={(e) => setGbEventTitle(e.target.value)} placeholder={gbFormat === 'event' ? 'Event title' : 'Offer headline'} className="w-full border border-line rounded-lg p-2 text-sm focus:border-brand outline-none" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={gbStartDate} onChange={(e) => setGbStartDate(e.target.value)} className="border border-line rounded-lg p-2 text-sm focus:border-brand outline-none" />
                <input type="date" value={gbEndDate} onChange={(e) => setGbEndDate(e.target.value)} className="border border-line rounded-lg p-2 text-sm focus:border-brand outline-none" />
              </div>
              {gbFormat === 'offer' && (
                <input value={gbCoupon} onChange={(e) => setGbCoupon(e.target.value)} placeholder="Coupon code (optional)" className="w-full border border-line rounded-lg p-2 text-sm focus:border-brand outline-none" />
              )}
            </div>
          )}

          <div className="mb-2">
            <label className="block text-xs text-ink-soft mb-1">Schedule for later (optional)</label>
            <input type="datetime-local" value={gbScheduleTime} onChange={(e) => setGbScheduleTime(e.target.value)} className="border border-line rounded-lg p-2 text-sm focus:border-brand outline-none" />
          </div>

          <Button
            type="button"
            size="sm"
            variant={showGbStudio ? 'secondary' : 'primary'}
            onClick={() => setShowGbStudio((v) => !v)}
            className="mb-3"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {showGbStudio ? 'Hide AI Studio' : 'Chat with AI for image + caption ideas'}
          </Button>

          {showGbStudio && (
            <div className="mb-3">
              <ImageStudio
                locationId={locationId}
                platform="google_business"
                composerImageUrl={gbMediaUrl.trim()}
                imageGenConfigured={imageGenConfigured}
                imageEditConfigured={imageEditConfigured}
                imageQuota={imageQuota}
                onQuotaUsed={refreshImageQuota}
                onFinalize={finalizeIntoGbComposer}
              />
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(gbBody)}>
              <Copy className="w-3.5 h-3.5" /> Copy
            </Button>
            <Button size="sm" onClick={publishGoogle} loading={gbPublishing} disabled={!gbBody.trim()}>
              <Send className="w-3.5 h-3.5" /> {gbScheduleTime ? 'Schedule' : 'Publish'}
            </Button>
          </div>
        </Card>
      )}

      {scheduledList.length > 0 && (
        <Card>
          <h2 className="font-semibold text-sm mb-3">Scheduled</h2>
          <div className="space-y-2">
            {scheduledList.map((s) => (
              <div key={s.id} className="border border-line rounded-lg p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <Badge tone={s.status === 'pending' ? 'brand' : s.status === 'published' ? 'success' : 'danger'}>{s.status}</Badge>
                  <span className="text-xs text-ink-soft">{new Date(s.scheduledFor).toLocaleString()}</span>
                </div>
                <p className="text-xs text-ink-soft line-clamp-2">{s.body}</p>
                <p className="text-xs text-ink-soft mt-1">{(s.platforms || []).join(', ')}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
