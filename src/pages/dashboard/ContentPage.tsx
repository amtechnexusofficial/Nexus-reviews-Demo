import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Send, Upload, Calendar } from 'lucide-react';
import { Card } from '../../components/ui';
import { Button } from '../../components/Button';
import { publishApi, aiContentApi } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';
import ImageStudio from './ImageStudio';

const CREATE_PLATFORMS = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
] as const;

const MEDIA_LIMITS: Record<string, { max: number; note: string }> = {
  instagram: { max: 10, note: '2-10 images = automatic carousel. 1 image = single post.' },
  facebook: { max: 10, note: 'Multiple images supported.' },
};

interface Connection {
  id: string;
  name: string;
  platform: string;
  status: string;
}

export default function ContentPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess, showError } = useToast();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [composerText, setComposerText] = useState('');
  const [composerMedia, setComposerMedia] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['instagram', 'facebook']);
  const [publishing, setPublishing] = useState(false);
  const [composerScheduleTime, setComposerScheduleTime] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [showGenericStudio, setShowGenericStudio] = useState(false);

  const [imageGenConfigured, setImageGenConfigured] = useState(false);
  const [imageEditConfigured, setImageEditConfigured] = useState(false);
  const [imageQuota, setImageQuota] = useState<{
    used: number;
    limit: number;
    plan: string;
    unlimited: boolean;
  } | null>(null);

  useEffect(() => {
    aiContentApi.imageStatus().then((s) => {
      setImageGenConfigured(s.configured);
      setImageEditConfigured(s.editConfigured);
    });
    aiContentApi.imageQuota().then(setImageQuota).catch(() => {});
  }, []);

  useEffect(() => {
    if (!locationId) return;
    publishApi
      .connections(locationId)
      .then(({ profiles }) => setConnections(profiles))
      .catch(() => setConnections([]));
  }, [locationId]);

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

  async function publishComposer(schedule: boolean) {
    if (!locationId || !composerText.trim() || selectedPlatforms.length === 0) return;
    if (schedule && !composerScheduleTime) {
      setShowSchedule(true);
      showError('Pick a date and time to schedule.');
      return;
    }

    const mediaUrls = composerMedia.trim()
      ? composerMedia.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    for (const p of selectedPlatforms) {
      const limit = MEDIA_LIMITS[p];
      if (limit && mediaUrls.length > limit.max) {
        showError(
          `${CREATE_PLATFORMS.find((x) => x.id === p)?.label || p} allows up to ${limit.max} images — you have ${mediaUrls.length}.`
        );
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
        scheduledFor: schedule ? new Date(composerScheduleTime).toISOString() : undefined,
        timezone: schedule ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined,
      });
      if (res.scheduled) {
        showSuccess(`Scheduled for ${new Date(composerScheduleTime).toLocaleString()}.`);
        setComposerText('');
        setComposerMedia('');
        setComposerScheduleTime('');
        setShowSchedule(false);
      } else if (res.published) {
        showSuccess(
          `Published to ${selectedPlatforms
            .map((p) => CREATE_PLATFORMS.find((x) => x.id === p)?.label || p)
            .join(', ')}.`
        );
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

  function refreshImageQuota() {
    aiContentApi.imageQuota().then(setImageQuota).catch(() => {});
  }

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
    if (caption.trim()) setShowGenericStudio(false);
  }

  if (!locationId) return null;

  const mediaCount = composerMedia
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean).length;

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold mb-1">Create Post</h1>
        <p className="text-sm text-ink-soft">
          Manage each platform on its own tab, or use &quot;All Platforms&quot; to post everywhere at once.
        </p>
      </div>

      {connections.filter((c) => c.status === 'active' || c.status === 'connected').length === 0 && (
        <div className="text-xs text-ink-soft bg-white/60 border border-line rounded-lg p-3">
          No platforms connected yet —{' '}
          <Link to="/dashboard/connections" className="text-brand underline font-medium">
            connect them in Connections
          </Link>{' '}
          first, then come back here to publish.
        </div>
      )}

      <Card>
        <h2 className="font-semibold text-sm mb-3">Compose for multiple platforms</h2>

        <div className="flex flex-wrap gap-2 mb-3">
          {CREATE_PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => togglePlatform(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                selectedPlatforms.includes(p.id)
                  ? 'bg-brand-soft text-brand border-transparent'
                  : 'border-line text-ink-soft'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

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

        <div className="mb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploadingImage}>
            <Upload className="w-3.5 h-3.5" /> Upload from device
          </Button>
        </div>

        {mediaCount > 0 && (
          <div className="mb-3">
            <div className="flex gap-2 flex-wrap mb-2">
              {composerMedia
                .split(',')
                .map((u) => u.trim())
                .filter(Boolean)
                .map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Media ${i + 1}`}
                    className="w-16 h-16 object-cover rounded-lg border border-line"
                    onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.2')}
                  />
                ))}
            </div>
            {selectedPlatforms.map((p) => {
              const limit = MEDIA_LIMITS[p];
              if (!limit) return null;
              const overLimit = mediaCount > limit.max;
              return (
                <p key={p} className={`text-xs ${overLimit ? 'text-danger' : 'text-ink-soft'}`}>
                  {CREATE_PLATFORMS.find((x) => x.id === p)?.label}: {limit.note}{' '}
                  {overLimit && `— you have ${mediaCount}, trim to ${limit.max}.`}
                </p>
              );
            })}
          </div>
        )}

        {showSchedule && (
          <div className="mb-3">
            <label className="block text-xs text-ink-soft mb-1">Schedule for</label>
            <input
              type="datetime-local"
              value={composerScheduleTime}
              onChange={(e) => setComposerScheduleTime(e.target.value)}
              className="border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
            />
          </div>
        )}

        <div className="flex gap-2 flex-wrap mb-3">
          <Button
            size="sm"
            onClick={() => publishComposer(false)}
            loading={publishing && !showSchedule}
            disabled={!composerText.trim() || selectedPlatforms.length === 0}
          >
            <Send className="w-3.5 h-3.5" /> Publish
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (!showSchedule) {
                setShowSchedule(true);
                return;
              }
              publishComposer(true);
            }}
            loading={publishing && showSchedule}
            disabled={!composerText.trim() || selectedPlatforms.length === 0}
          >
            <Calendar className="w-3.5 h-3.5" /> Schedule
          </Button>
        </div>

        <Button
          type="button"
          size="sm"
          variant={showGenericStudio ? 'secondary' : 'primary'}
          onClick={() => setShowGenericStudio((v) => !v)}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {showGenericStudio ? 'Hide AI Studio' : 'Chat with AI for image + caption ideas'}
        </Button>

        {showGenericStudio && (
          <div className="mt-3">
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
      </Card>
    </div>
  );
}
