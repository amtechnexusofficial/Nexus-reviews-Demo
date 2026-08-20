import { useEffect, useRef, useState } from 'react';
import { Card } from '../../components/ui';
import { Button } from '../../components/Button';
import { businessesApi, knowledgeApi, kioskApi, type KnowledgeEntry } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { Sparkles, Upload, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../../lib/toast';

export default function SettingsPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess, showError } = useToast();

  const [websiteUrl, setWebsiteUrl] = useState('');
  const [customContext, setCustomContext] = useState('');
  const [savedWebsiteUrl, setSavedWebsiteUrl] = useState('');
  const [savedCustomContext, setSavedCustomContext] = useState('');
  const [loadingAiContext, setLoadingAiContext] = useState(false);
  const [savingAiContext, setSavingAiContext] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const aiContextDirty =
    websiteUrl.trim() !== savedWebsiteUrl.trim() || customContext.trim() !== savedCustomContext.trim();

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [factTitle, setFactTitle] = useState('');
  const [factContent, setFactContent] = useState('');
  const [addingFact, setAddingFact] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [togglingAutoReply, setTogglingAutoReply] = useState(false);
  const [kioskQuestions, setKioskQuestions] = useState<string[]>(['', '', '', '', '']);
  const [savedKioskQuestions, setSavedKioskQuestions] = useState<string[]>(['', '', '', '', '']);
  const [savingKioskQuestions, setSavingKioskQuestions] = useState(false);
  const kioskQuestionsDirty = kioskQuestions.some((q, i) => q !== (savedKioskQuestions[i] || ''));

  const [googleReviewLink, setGoogleReviewLink] = useState('');
  const [savedGoogleReviewLink, setSavedGoogleReviewLink] = useState('');
  const [savingReviewLink, setSavingReviewLink] = useState(false);
  const reviewLinkDirty = googleReviewLink.trim() !== savedGoogleReviewLink.trim();

  async function loadEntries() {
    if (!locationId) return;
    const { entries } = await knowledgeApi.list(locationId);
    setEntries(entries);
  }

  useEffect(() => {
    if (!locationId) {
      setWebsiteUrl('');
      setCustomContext('');
      setSavedWebsiteUrl('');
      setSavedCustomContext('');
      setEntries([]);
      setAutoReplyEnabled(false);
      setKioskQuestions(['', '', '', '', '']);
      setSavedKioskQuestions(['', '', '', '', '']);
      setGoogleReviewLink('');
      setSavedGoogleReviewLink('');
      return;
    }
    setLoadingAiContext(true);
    Promise.all([
      knowledgeApi.getContext(locationId),
      knowledgeApi.list(locationId),
      knowledgeApi.getAutoReply(locationId),
      kioskApi.getCustomQuestions(locationId),
      businessesApi.getLocation(locationId),
    ])
      .then(([context, { entries }, autoReply, kiosk, { location }]) => {
        setWebsiteUrl(context.websiteUrl);
        setCustomContext(context.customContext);
        setSavedWebsiteUrl(context.websiteUrl);
        setSavedCustomContext(context.customContext);
        setEntries(entries);
        setAutoReplyEnabled(Boolean(autoReply.enabled));
        setKioskQuestions(kiosk.questions);
        setSavedKioskQuestions(kiosk.questions);
        const link = location?.googleReviewLink || '';
        setGoogleReviewLink(link);
        setSavedGoogleReviewLink(link);
      })
      .catch((error) => showError(error.message || 'Could not load settings.'))
      .finally(() => setLoadingAiContext(false));
  }, [locationId]);

  async function toggleAutoReply() {
    if (!locationId) return;
    setTogglingAutoReply(true);
    try {
      const result = await knowledgeApi.setAutoReply(locationId, !autoReplyEnabled);
      setAutoReplyEnabled(result.enabled);
      if (!result.enabled) {
        showSuccess('AI auto-reply is off.');
      } else if (result.webhook && !result.webhook.ok) {
        showError(
          result.webhook.error ||
            'Auto-reply is on, but the webhook could not be registered — replies will not send until that is fixed.'
        );
      } else {
        showSuccess('AI auto-reply is on. New DMs will be answered from your AI knowledge when possible.');
      }
    } catch (error: any) {
      showError(error.message || 'Could not update AI auto-reply.');
    } finally {
      setTogglingAutoReply(false);
    }
  }

  async function saveKioskQuestions() {
    if (!locationId || !kioskQuestionsDirty) return;
    setSavingKioskQuestions(true);
    try {
      const { questions } = await kioskApi.saveCustomQuestions(locationId, kioskQuestions);
      setKioskQuestions(questions);
      setSavedKioskQuestions(questions);
      showSuccess('Kiosk questions saved.');
    } catch (error: any) {
      showError(error.message || 'Could not save kiosk questions.');
    } finally {
      setSavingKioskQuestions(false);
    }
  }

  async function saveReviewLink() {
    if (!locationId || !reviewLinkDirty) return;
    setSavingReviewLink(true);
    try {
      const { location } = await businessesApi.setGoogleReviewLink(locationId, googleReviewLink);
      const link = location?.googleReviewLink || '';
      setGoogleReviewLink(link);
      setSavedGoogleReviewLink(link);
      showSuccess('Google review link saved.');
    } catch (error: any) {
      showError(error.message || 'Could not save review link.');
    } finally {
      setSavingReviewLink(false);
    }
  }

  async function saveAiContext() {
    if (!locationId || !aiContextDirty) return;
    setSavingAiContext(true);
    setSaveStatus('Saving…');
    try {
      const url = websiteUrl.trim();
      let crawledContext: string | undefined;

      if (url) {
        setSaveStatus('Starting website crawl…');
        const { jobId } = await knowledgeApi.startWebsiteCrawl(locationId, url);

        for (;;) {
          const status = await knowledgeApi.websiteCrawlStatus(locationId, jobId);
          if (status.status === 'completed' && status.context) {
            crawledContext = status.context;
            const pages =
              status.total && status.total > 0
                ? `${status.completed || status.total}/${status.total} pages`
                : `${status.completed || ''} pages`.trim();
            setSaveStatus(pages ? `Crawl complete (${pages}). Saving knowledge…` : 'Crawl complete. Saving knowledge…');
            break;
          }
          if (status.status === 'failed') {
            throw new Error(status.error || 'Website crawl failed.');
          }
          const progress =
            status.total && status.total > 0
              ? `${status.completed || 0} of ${status.total} pages`
              : status.completed
                ? `${status.completed} pages so far`
                : 'discovering pages';
          setSaveStatus(`Crawling website… ${progress}`);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      setSaveStatus('Updating knowledge base…');
      const saved = await knowledgeApi.saveContext(locationId, {
        websiteUrl: url,
        customContext,
        websiteContext: crawledContext,
        skipCrawl: true,
      });
      setWebsiteUrl(saved.websiteUrl);
      setCustomContext(saved.customContext);
      setSavedWebsiteUrl(saved.websiteUrl);
      setSavedCustomContext(saved.customContext);
      showSuccess(
        url
          ? 'Website crawl finished and AI knowledge is updated.'
          : 'AI knowledge saved. Future posts and DM replies will use it.'
      );
    } catch (error: any) {
      showError(error.message || 'Could not save AI knowledge.');
    } finally {
      setSavingAiContext(false);
      setSaveStatus('');
    }
  }

  async function addFact() {
    if (!locationId || !factTitle.trim() || !factContent.trim()) return;
    setAddingFact(true);
    try {
      await knowledgeApi.create({ locationId, title: factTitle.trim(), content: factContent.trim() });
      setFactTitle('');
      setFactContent('');
      await loadEntries();
      showSuccess('Fact added.');
    } catch (error: any) {
      showError(error.message || 'Could not add fact.');
    } finally {
      setAddingFact(false);
    }
  }

  async function removeFact(id: number) {
    try {
      await knowledgeApi.remove(id);
      await loadEntries();
    } catch (error: any) {
      showError(error.message || 'Could not remove fact.');
    }
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!locationId) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      await knowledgeApi.uploadPdf(locationId, file);
      await loadEntries();
      showSuccess(`Added facts from ${file.name}.`);
    } catch (error: any) {
      showError(error.message || 'Could not upload PDF.');
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-6">Settings</h1>

      {locationId && (
        <Card className="mb-6">
          <h2 className="font-semibold mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" /> AI knowledge
          </h2>
          <p className="text-sm text-ink-soft mb-4">
            This information personalizes AI-generated posts and DM replies for your business.
          </p>

          {loadingAiContext ? (
            <p className="text-sm text-ink-soft">Loading...</p>
          ) : (
            <>
              <label className="block text-xs font-medium mb-1.5">Business website</label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://yourbusiness.com"
                className="w-full border border-line rounded-lg p-2.5 text-sm mb-4 focus:border-brand outline-none"
              />

              <label className="block text-xs font-medium mb-1.5">Additional business context</label>
              <textarea
                value={customContext}
                onChange={(e) => setCustomContext(e.target.value)}
                rows={5}
                placeholder="Add your opening hours, products or menu, prices, offers, policies, brand voice, audience, and anything else the AI should know."
                className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none resize-y"
              />
              <p className="text-xs text-ink-soft mb-3">
                Saving crawls your website with Firecrawl (all reachable pages). The button stays busy with
                live progress until the crawl finishes and knowledge is updated.
              </p>
              <Button size="sm" onClick={saveAiContext} loading={savingAiContext} disabled={!aiContextDirty || savingAiContext}>
                {savingAiContext ? saveStatus || 'Working…' : 'Save AI knowledge'}
              </Button>
              {savingAiContext && saveStatus && (
                <p className="text-xs text-brand mt-2 font-medium">{saveStatus}</p>
              )}

              <div className="mt-6 pt-5 border-t border-line">
                <h3 className="font-semibold text-sm mb-1">Knowledge base facts</h3>
                <p className="text-xs text-ink-soft mb-4 leading-relaxed">
                  Add specific facts one at a time — opening hours, menu items, prices, policies, FAQs. These
                  are used alongside your website crawl and business context above. You can also upload a
                  text-based PDF (menu, price list, policy doc) and we&apos;ll extract the text for you.
                </p>

                <input
                  value={factTitle}
                  onChange={(e) => setFactTitle(e.target.value)}
                  placeholder="Title — e.g. 'Opening hours', 'Menu'"
                  className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none"
                />
                <textarea
                  value={factContent}
                  onChange={(e) => setFactContent(e.target.value)}
                  rows={3}
                  placeholder="Paste the actual details here..."
                  className="w-full border border-line rounded-lg p-2.5 text-sm mb-3 focus:border-brand outline-none resize-y"
                />

                <div className="flex gap-2 flex-wrap mb-4">
                  <Button
                    size="sm"
                    onClick={addFact}
                    loading={addingFact}
                    disabled={!factTitle.trim() || !factContent.trim()}
                  >
                    Add fact
                  </Button>
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => pdfInputRef.current?.click()}
                    loading={uploadingPdf}
                  >
                    <Upload className="w-3.5 h-3.5" /> Upload PDF
                  </Button>
                </div>

                {entries.length > 0 && (
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="border border-line rounded-lg p-3 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{entry.title}</div>
                          <p className="text-xs text-ink-soft mt-0.5 line-clamp-3">{entry.content}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFact(entry.id)}
                          className="text-ink-soft hover:text-danger shrink-0"
                          title="Remove fact"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </Card>
      )}

      {locationId && (
        <Card className="mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-semibold mb-1">Automatic AI replies to DMs</h2>
              <p className="text-sm text-ink-soft leading-relaxed">
                Off by default. When on, the AI answers only from your website crawl and AI knowledge. If it
                doesn&apos;t know, or the customer asks for a person, it tells them a human will contact them
                soon and flags the chat for you.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleAutoReply}
              disabled={togglingAutoReply}
              aria-pressed={autoReplyEnabled}
              aria-label={autoReplyEnabled ? 'Turn off automatic AI replies' : 'Turn on automatic AI replies'}
              className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                autoReplyEnabled ? 'bg-brand' : 'bg-line'
              }`}
            >
              <span
                className={`pointer-events-none absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  autoReplyEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>
      )}

      {locationId && (
        <Card className="mb-6">
          <h2 className="font-semibold mb-1">Kiosk review questions</h2>
          <p className="text-sm text-ink-soft mb-4">
            These questions appear after a customer picks stars on your QR kiosk. Leave blank to use
            rating-based defaults. Up to 5 questions.
          </p>
          <div className="space-y-2 mb-4">
            {kioskQuestions.map((q, i) => (
              <input
                key={i}
                value={q}
                onChange={(e) =>
                  setKioskQuestions((prev) => prev.map((item, idx) => (idx === i ? e.target.value : item)))
                }
                placeholder={`Question ${i + 1}`}
                className="w-full border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none"
              />
            ))}
          </div>
          <Button
            size="sm"
            onClick={saveKioskQuestions}
            loading={savingKioskQuestions}
            disabled={!kioskQuestionsDirty || savingKioskQuestions}
          >
            Save questions
          </Button>
        </Card>
      )}

      {locationId && (
        <Card className="mb-6">
          <h2 className="font-semibold mb-1">Google review link</h2>
          <p className="text-sm text-ink-soft mb-4">
            Used when a customer taps Post on the kiosk — opens your Google review page so they can paste and
            submit. Paste the write-a-review or Maps place link for your Google listing.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={googleReviewLink}
              onChange={(e) => setGoogleReviewLink(e.target.value)}
              placeholder="https://g.page/r/.../review"
              className="flex-1 border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none"
            />
            <Button size="sm" onClick={saveReviewLink} loading={savingReviewLink} disabled={!reviewLinkDirty}>
              Save
            </Button>
          </div>
        </Card>
      )}

      <p className="text-xs text-ink-soft text-center mt-8">
        <Link to="/legal/terms" className="underline">Terms</Link> · <Link to="/legal/privacy" className="underline">Privacy</Link>
      </p>
    </div>
  );
}
