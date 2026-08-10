import { useEffect, useRef, useState } from 'react';
import { Upload, Sparkles, Send, Check, ImagePlus, Download, Wand2, Type } from 'lucide-react';
import { Card, Badge } from '../../components/ui';
import { Button } from '../../components/Button';
import { aiContentApi } from '../../lib/api';
import { useToast } from '../../lib/toast';

interface ImageStudioProps {
  locationId: number;
  platform?: string;
  /** Final image currently in the composer — required for caption mode. */
  composerImageUrl: string;
  imageGenConfigured: boolean;
  imageEditConfigured: boolean;
  imageQuota: { used: number; limit: number; plan: string; unlimited: boolean } | null;
  onQuotaUsed: () => void;
  /** Either field may be empty — send whatever the user selected. */
  onFinalize: (imageUrl: string, caption: string) => void;
}

type StudioMode = 'image' | 'caption';

type ImageChatItem =
  | { kind: 'text'; role: 'user' | 'assistant'; content: string }
  | { kind: 'image'; role: 'user' | 'assistant'; url: string };

type CaptionChatItem = { role: 'user' | 'assistant'; content: string };

const AUTO_CAPTION_PROMPT =
  'Write a social media caption for this image. Output ONLY the caption text — no preamble, no quotes.';

export default function ImageStudio({
  locationId,
  platform,
  composerImageUrl,
  imageGenConfigured,
  imageEditConfigured,
  imageQuota,
  onQuotaUsed,
  onFinalize,
}: ImageStudioProps) {
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<StudioMode>('image');

  // Shared selection — pick an image in one tab and a caption in the other, then send both.
  const [selectedImageUrl, setSelectedImageUrl] = useState('');
  const [selectedCaption, setSelectedCaption] = useState('');

  // -------- Image mode state --------
  const [imageThread, setImageThread] = useState<ImageChatItem[]>([]);
  const [imageInput, setImageInput] = useState('');
  const [generatingInChat, setGeneratingInChat] = useState(false);
  const [editingImage, setEditingImage] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');

  // -------- Caption mode state --------
  const [captionThread, setCaptionThread] = useState<CaptionChatItem[]>([]);
  const [captionInput, setCaptionInput] = useState('');
  const [draftingCaption, setDraftingCaption] = useState(false);
  const [captionImageUrl, setCaptionImageUrl] = useState(composerImageUrl);

  const quotaReached = imageQuota ? !imageQuota.unlimited && imageQuota.used >= imageQuota.limit : false;
  const busy = generatingInChat || editingImage || uploading || draftingCaption;
  const hasComposerImage = Boolean(composerImageUrl.trim());

  // If the composer image changes, reset the caption chat so drafts stay tied to the photo on screen.
  useEffect(() => {
    if (composerImageUrl !== captionImageUrl) {
      setCaptionImageUrl(composerImageUrl);
      setCaptionThread([]);
      setCaptionInput('');
      setSelectedCaption('');
    }
  }, [composerImageUrl, captionImageUrl]);

  async function handleGenerateImage() {
    if (!imageInput.trim() || !imageGenConfigured || quotaReached) return;
    const prompt = imageInput;
    setImageInput('');
    setImageThread((prev) => [...prev, { kind: 'text', role: 'user', content: `Generate: ${prompt}` }]);
    setGeneratingInChat(true);
    try {
      const { url, error, quotaExceeded } = await aiContentApi.generateImage(locationId, prompt);
      if (error) {
        showError(error);
        if (quotaExceeded) onQuotaUsed();
        return;
      }
      onQuotaUsed();
      setImageThread((prev) => [...prev, { kind: 'image', role: 'assistant', url }]);
      setCurrentImageUrl(url);
    } catch (e: any) {
      showError(e.message || 'Generation failed.');
    } finally {
      setGeneratingInChat(false);
    }
  }

  async function handleEditImage() {
    if (!imageInput.trim() || !currentImageUrl || !imageEditConfigured || quotaReached) return;
    const instruction = imageInput;
    setImageInput('');
    setImageThread((prev) => [...prev, { kind: 'text', role: 'user', content: `Change: ${instruction}` }]);
    setEditingImage(true);
    try {
      const { url, error, quotaExceeded } = await aiContentApi.editImage(locationId, currentImageUrl, instruction);
      if (error) {
        showError(error);
        if (quotaExceeded) onQuotaUsed();
        return;
      }
      onQuotaUsed();
      setImageThread((prev) => [...prev, { kind: 'image', role: 'assistant', url }]);
      setCurrentImageUrl(url);
    } catch (e: any) {
      showError(e.message || 'Could not apply that change.');
    } finally {
      setEditingImage(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { url, error } = await aiContentApi.uploadImage(locationId, file);
      if (error) {
        showError(error);
        return;
      }
      setImageThread((prev) => [...prev, { kind: 'image', role: 'user', url }]);
      setCurrentImageUrl(url);
    } catch (err: any) {
      showError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function runCaptionMessage(message: string, displayAsUser: string) {
    if (!composerImageUrl.trim()) return;
    setCaptionThread((prev) => [...prev, { role: 'user', content: displayAsUser }]);
    setDraftingCaption(true);
    try {
      const { reply } = await aiContentApi.chatAboutCaption({
        locationId,
        platform,
        imageUrl: composerImageUrl,
        conversation: captionThread,
        message,
      });
      setCaptionThread((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (e: any) {
      showError(e.message || 'Could not draft a caption.');
    } finally {
      setDraftingCaption(false);
    }
  }

  async function handleCaptionChat() {
    if (!captionInput.trim() || !hasComposerImage) return;
    const message = captionInput;
    setCaptionInput('');
    await runCaptionMessage(message, message);
  }

  async function handleAutoCaption() {
    if (!hasComposerImage || draftingCaption) return;
    await runCaptionMessage(AUTO_CAPTION_PROMPT, 'Auto-generate a caption for this image');
  }

  function useThisImage(url: string) {
    setSelectedImageUrl(url);
    setCurrentImageUrl(url);
    showSuccess('Image selected.');
  }

  function useThisCaption(text: string) {
    setSelectedCaption(text);
    showSuccess('Caption selected.');
  }

  function downloadImage(url: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = 'image.png';
    a.target = '_blank';
    a.click();
  }

  function clearActiveMode() {
    if (mode === 'image') {
      setImageThread([]);
      setCurrentImageUrl('');
      setImageInput('');
    } else {
      setCaptionThread([]);
      setCaptionInput('');
    }
  }

  function finalize() {
    if (!selectedImageUrl && !selectedCaption.trim()) {
      showError('Select an image or a caption first.');
      return;
    }
    // If this image is already in the composer (from a previous "Send"), don't
    // attach it again when the user later sends a caption.
    const imageToSend = selectedImageUrl && selectedImageUrl === composerImageUrl ? '' : selectedImageUrl;
    onFinalize(imageToSend, selectedCaption);
    if (selectedCaption.trim()) {
      showSuccess('Caption sent to the composer — review and publish.');
      setSelectedCaption('');
    } else {
      showSuccess('Image sent to the composer. Switch to Caption to draft copy for it.');
      setSelectedImageUrl('');
      setMode('caption');
    }
  }

  function requestCaptionMode() {
    if (!hasComposerImage) {
      setMode('caption');
      return;
    }
    setMode('caption');
  }

  const activeThreadEmpty = mode === 'image' ? imageThread.length === 0 : captionThread.length === 0;

  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-brand" /> AI Studio
        </h2>
        {!activeThreadEmpty && (
          <button onClick={clearActiveMode} className="text-xs text-ink-soft hover:text-danger">
            Clear
          </button>
        )}
      </div>
      <p className="text-xs text-ink-soft mb-3">
        Generate or upload an image, send it to the composer, then draft a caption that fits the photo.
      </p>

      {/* Toggle: Image | Caption */}
      <div className="flex rounded-lg border border-line overflow-hidden mb-3">
        <button
          type="button"
          onClick={() => setMode('image')}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
            mode === 'image' ? 'bg-brand text-white' : 'bg-paper text-ink-soft hover:text-ink'
          }`}
        >
          <ImagePlus className="w-3.5 h-3.5" /> Image
        </button>
        <button
          type="button"
          onClick={requestCaptionMode}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors border-l border-line ${
            mode === 'caption' ? 'bg-brand text-white' : 'bg-paper text-ink-soft hover:text-ink'
          }`}
        >
          <Type className="w-3.5 h-3.5" /> Caption
        </button>
      </div>

      {mode === 'image' && (
        <>
          {!imageGenConfigured && (
            <p className="text-xs text-warning bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
              Generation isn't configured yet — add an AI binding in wrangler.jsonc, or GEMINI_API_KEY / OPENAI_API_KEY.
              Uploading a real photo still works below.
            </p>
          )}
          {imageQuota && (
            <div className="mb-2">
              <Badge tone={quotaReached ? 'warning' : 'neutral'}>
                {imageQuota.unlimited
                  ? `${imageQuota.used} AI images this month · unlimited`
                  : `${imageQuota.used}/${imageQuota.limit} AI images this month · ${imageQuota.plan}`}
              </Badge>
            </div>
          )}

          {imageThread.length > 0 && (
            <div className="border border-line rounded-lg p-3 my-3 max-h-96 overflow-y-auto space-y-2">
              {imageThread.map((item, i) => (
                <div key={i} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {item.kind === 'text' ? (
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                        item.role === 'user' ? 'bg-brand text-white' : 'bg-paper border border-line'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{item.content}</p>
                    </div>
                  ) : (
                    <div className="max-w-[70%]">
                      <img src={item.url} alt="Generated" className="w-full rounded-lg border border-line mb-1.5" />
                      <div className="flex gap-2 items-center flex-wrap">
                        <button
                          onClick={() => downloadImage(item.url)}
                          className="text-[10px] font-semibold text-ink-soft flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                        <button
                          onClick={() => useThisImage(item.url)}
                          className="text-[10px] font-semibold text-brand underline"
                        >
                          Use this image
                        </button>
                        {selectedImageUrl === item.url && <Badge tone="brand">Selected ✓</Badge>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {(generatingInChat || editingImage) && (
                <div className="flex justify-start">
                  <div className="bg-paper border border-line rounded-xl px-3 py-2 text-xs text-ink-soft flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 animate-pulse" />{' '}
                    {generatingInChat ? 'Generating...' : 'Applying your change...'}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mb-2">
            <input
              value={imageInput}
              onChange={(e) => setImageInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerateImage()}
              placeholder={
                currentImageUrl
                  ? 'Describe a change, or a brand-new image...'
                  : 'Describe the image you want...'
              }
              className="flex-1 border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            <Button
              size="sm"
              onClick={handleGenerateImage}
              loading={generatingInChat}
              disabled={!imageInput.trim() || !imageGenConfigured || quotaReached}
            >
              <Wand2 className="w-3.5 h-3.5" /> Generate
            </Button>
            {currentImageUrl && imageEditConfigured && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleEditImage}
                loading={editingImage}
                disabled={!imageInput.trim() || quotaReached}
              >
                <Wand2 className="w-3.5 h-3.5" /> Apply change
              </Button>
            )}
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                <Upload className="w-3.5 h-3.5" /> Upload photo
              </Button>
            </div>
          </div>
        </>
      )}

      {mode === 'caption' && !hasComposerImage && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3 mb-3">
          <p className="text-xs text-warning font-medium mb-1">Add a photo first</p>
          <p className="text-xs text-ink-soft mb-3">
            Caption chat uses the image in the composer so it can write about what you are posting. Generate or
            upload a photo, select it, then send it to the composer — or paste/upload an image into the media
            field below.
          </p>
          <Button size="sm" onClick={() => setMode('image')}>
            <ImagePlus className="w-3.5 h-3.5" /> Go to Image
          </Button>
        </div>
      )}

      {mode === 'caption' && hasComposerImage && (
        <>
          <div className="flex items-center gap-3 mb-3 p-2 border border-line rounded-lg bg-paper">
            <img
              src={composerImageUrl}
              alt="Composer image"
              className="w-14 h-14 object-cover rounded-lg border border-line"
            />
            <p className="text-xs text-ink-soft flex-1">
              Captioning this composer image. Auto-generate a first draft, then ask for changes in chat.
            </p>
          </div>

          {captionThread.length > 0 && (
            <div className="border border-line rounded-lg p-3 my-3 max-h-96 overflow-y-auto space-y-2">
              {captionThread.map((item, i) => (
                <div key={i} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                      item.role === 'user' ? 'bg-brand text-white' : 'bg-paper border border-line'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{item.content}</p>
                    {item.role === 'assistant' && (
                      <button
                        onClick={() => useThisCaption(item.content)}
                        className="mt-1.5 text-[10px] font-semibold text-brand underline"
                      >
                        Use this caption
                      </button>
                    )}
                    {selectedCaption === item.content && <Badge tone="brand">Selected caption ✓</Badge>}
                  </div>
                </div>
              ))}
              {draftingCaption && (
                <div className="flex justify-start">
                  <div className="bg-paper border border-line rounded-xl px-3 py-2 text-xs text-ink-soft flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 animate-pulse" /> Drafting...
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 mb-2">
            <input
              value={captionInput}
              onChange={(e) => setCaptionInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCaptionChat()}
              placeholder={
                captionThread.length === 0
                  ? 'Or describe the caption you want...'
                  : 'Ask for a revision — shorter, more hashtags, warmer tone...'
              }
              className="flex-1 border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
            />
          </div>
          <div className="flex gap-2 flex-wrap mb-3">
            <Button size="sm" onClick={handleAutoCaption} loading={draftingCaption} disabled={draftingCaption}>
              <Wand2 className="w-3.5 h-3.5" /> Auto-generate caption
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleCaptionChat}
              disabled={!captionInput.trim() || draftingCaption}
            >
              <Send className="w-3.5 h-3.5" /> {captionThread.length === 0 ? 'Generate from prompt' : 'Send'}
            </Button>
          </div>
        </>
      )}

      {(selectedImageUrl || selectedCaption) && (
        <div className="border border-brand/30 bg-brand-soft rounded-lg p-3 mb-3">
          <p className="text-xs font-medium text-brand mb-2">Ready to send</p>
          <div className="flex items-center gap-3">
            {selectedImageUrl ? (
              <img
                src={selectedImageUrl}
                alt="Selected"
                className="w-12 h-12 object-cover rounded-lg border border-white/60"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg border border-dashed border-brand/40 flex items-center justify-center text-[9px] text-ink-soft text-center px-1">
                no image
              </div>
            )}
            <p className="text-xs text-ink flex-1 line-clamp-2">
              {selectedCaption || 'no caption selected yet'}
            </p>
          </div>
        </div>
      )}

      <Button size="sm" onClick={finalize} disabled={busy || (!selectedImageUrl && !selectedCaption.trim())}>
        <Check className="w-3.5 h-3.5" /> Send to composer
      </Button>
    </Card>
  );
}
