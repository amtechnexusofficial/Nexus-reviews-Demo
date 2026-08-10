import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, ExternalLink, Check, RotateCcw, Send } from 'lucide-react';
import { Button } from '../../components/Button';
import { StarRating } from '../../components/ui';
import { kioskApi, kioskFeedbackApi } from '../../lib/api';
import { branding } from '../../config/branding';

type Step = 'rating' | 'questions' | 'length' | 'draft' | 'done';

const STEPS: { key: Step; label: string }[] = [
  { key: 'rating', label: 'Rate' },
  { key: 'questions', label: 'Answer' },
  { key: 'length', label: 'Draft' },
  { key: 'done', label: 'Post' },
];

const LENGTH_OPTIONS = [
  { label: 'Short', words: 20, sub: '~20 words' },
  { label: 'Medium', words: 50, sub: '~50 words' },
  { label: 'Long', words: 100, sub: '~100 words' },
];

export default function KioskPage() {
  const [params] = useSearchParams();
  // In production these come from the QR code's own URL, e.g. /kiosk?location=3
  const locationId = Number(params.get('location') || 1);
  const businessName = params.get('name') || 'this business';
  const googleReviewLinkParam = params.get('reviewLink') || '';

  const [step, setStep] = useState<Step>('rating');
  const [rating, setRating] = useState(0);
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>(['', '', '']);
  const [targetLength, setTargetLength] = useState(20);
  const [draft, setDraft] = useState('');
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [googleReviewLink, setGoogleReviewLink] = useState(googleReviewLinkParam);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Additive private feedback — available regardless of rating, alongside
  // (never instead of) the public post option above.
  const [showPrivateFeedback, setShowPrivateFeedback] = useState(false);
  const [privateFeedbackText, setPrivateFeedbackText] = useState('');
  const [privateFeedbackContact, setPrivateFeedbackContact] = useState('');
  const [sendingPrivateFeedback, setSendingPrivateFeedback] = useState(false);
  const [privateFeedbackSent, setPrivateFeedbackSent] = useState(false);

  const stepIndex = STEPS.findIndex((s) => s.key === (step === 'draft' ? 'length' : step));

  async function selectRating(v: number) {
    setRating(v);
    setError('');
    try {
      const { questions } = await kioskApi.getQuestions(v);
      setQuestions(questions);
      setStep('questions');
    } catch {
      setError("Couldn't load questions — check your connection and try again.");
    }
  }

  async function generate() {
    setLoading(true);
    setError('');
    try {
      const qa = questions.map((q, i) => ({ q, a: answers[i] || '' }));
      const res = await kioskApi.generate({ locationId, rating, answers: qa, targetLength });
      setDraft(res.draft);
      setSessionId(res.session.id);
      if (res.googleReviewLink) setGoogleReviewLink(res.googleReviewLink);
      setStep('draft');
    } catch {
      setError("Couldn't generate a draft just now — try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  async function regenerate() {
    await generate();
  }

  async function postReview() {
    if (sessionId) {
      await kioskApi.confirm(sessionId, { editedDraft: draft, confirmedAuthentic: true }).catch(() => {});
    }
    navigator.clipboard.writeText(draft).catch(() => {});
    if (googleReviewLink) window.open(googleReviewLink, '_blank');
    setStep('done');
  }

  async function sendPrivateFeedback() {
    if (!privateFeedbackText.trim()) return;
    setSendingPrivateFeedback(true);
    try {
      await kioskFeedbackApi.submit({
        locationId,
        rating,
        message: privateFeedbackText,
        customerContact: privateFeedbackContact || undefined,
      });
      setPrivateFeedbackSent(true);
    } catch {
      // fail quietly here — this is a bonus channel, not the main flow;
      // the customer's public review option above is completely unaffected
    } finally {
      setSendingPrivateFeedback(false);
    }
  }

  function reset() {
    setStep('rating');
    setRating(0);
    setAnswers(['', '', '']);
    setTargetLength(20);
    setDraft('');
    setConfirmed(false);
    setSessionId(null);
    setError('');
    setShowPrivateFeedback(false);
    setPrivateFeedbackText('');
    setPrivateFeedbackContact('');
    setPrivateFeedbackSent(false);
  }

  return (
    <div className="min-h-dvh flex flex-col">
      {/* step rail — signature element, real sequence info */}
      <div className="sticky top-0 glass px-4 pt-4 pb-3 z-10">
        <div className="flex items-center max-w-md mx-auto">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    i < stepIndex
                      ? 'bg-gradient-to-r from-brand to-brand-2 text-white'
                      : i === stepIndex
                      ? 'bg-gradient-to-r from-brand to-brand-2 text-white ring-4 ring-brand-soft'
                      : 'bg-white/70 border border-white/80 text-ink-soft'
                  }`}
                >
                  {i < stepIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="text-[10px] text-ink-soft font-medium">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-px flex-1 mx-1 mb-4 ${i < stepIndex ? 'bg-brand' : 'bg-line'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 px-5 py-8 max-w-md mx-auto w-full">
        {step === 'rating' && (
          <div className="text-center">
            <p className="text-xs font-semibold tracking-wide uppercase text-brand mb-2">{businessName}</p>
            <h1 className="font-display text-3xl font-semibold mb-2 leading-tight">
              How was your visit?
            </h1>
            <p className="text-sm text-ink-soft mb-8">Tap a star to get started — takes about 30 seconds.</p>
            <div className="flex justify-center">
              <StarRating value={rating} onChange={selectRating} size={44} />
            </div>
            {error && <p className="text-sm text-danger mt-6">{error}</p>}
          </div>
        )}

        {step === 'questions' && (
          <div>
            <h2 className="font-display text-xl font-semibold mb-1">A few quick details</h2>
            <p className="text-sm text-ink-soft mb-6">Short answers are fine — a few words each.</p>
            <div className="space-y-5">
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-ink mb-1.5">{q}</label>
                  <input
                    type="text"
                    value={answers[i]}
                    onChange={(e) => {
                      const next = [...answers];
                      next[i] = e.target.value;
                      setAnswers(next);
                    }}
                    placeholder="Your answer..."
                    className="w-full px-3.5 py-2.5 border border-line rounded-lg text-sm focus:border-brand outline-none"
                  />
                </div>
              ))}
            </div>
            <Button className="w-full mt-7" onClick={() => setStep('length')}>
              Next
            </Button>
          </div>
        )}

        {step === 'length' && (
          <div>
            <h2 className="font-display text-xl font-semibold mb-1">How long should it be?</h2>
            <p className="text-sm text-ink-soft mb-6">We'll write it in your words, at the length you pick.</p>
            <div className="grid grid-cols-3 gap-2 mb-7">
              {LENGTH_OPTIONS.map((opt) => (
                <button
                  key={opt.words}
                  onClick={() => setTargetLength(opt.words)}
                  className={`text-center py-3 px-2 rounded-lg border text-sm font-medium transition-colors ${
                    targetLength === opt.words
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-line text-ink-soft'
                  }`}
                >
                  <div>{opt.label}</div>
                  <div className="text-[11px] font-normal mt-0.5">{opt.sub}</div>
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={generate} loading={loading}>
              Generate my review
            </Button>
            {error && <p className="text-sm text-danger mt-4">{error}</p>}
          </div>
        )}

        {step === 'draft' && (
          <div>
            <h2 className="font-display text-xl font-semibold mb-1">Your review</h2>
            <p className="text-sm text-ink-soft mb-4">Read it over — edit anything that doesn't sound like you.</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={7}
              className="w-full border border-line rounded-lg p-3.5 text-sm leading-relaxed focus:border-brand outline-none resize-none"
            />
            <p className="text-xs text-ink-soft text-right mt-1.5 mb-4">
              {draft.trim().split(/\s+/).filter(Boolean).length} words
            </p>
            <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[var(--brand-color)]"
              />
              <span className="text-xs text-ink-soft leading-relaxed">
                This reflects my genuine experience, in my own words.
              </span>
            </label>
            <div className="flex gap-2.5 mb-5">
              <Button variant="secondary" className="flex-1" onClick={regenerate} loading={loading}>
                <RotateCcw className="w-4 h-4" /> Regenerate
              </Button>
              <Button className="flex-1" disabled={!confirmed} onClick={postReview}>
                <ExternalLink className="w-4 h-4" /> Post to Google
              </Button>
            </div>

            {/* Additive — available regardless of rating, never replaces the option above */}
            <div className="pt-4 border-t border-line">
              {!showPrivateFeedback ? (
                <button
                  onClick={() => setShowPrivateFeedback(true)}
                  className="text-xs text-brand underline"
                >
                  Also want to tell {businessName} directly?
                </button>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-ink-soft mb-1.5">
                    Message to the owner (private, in addition to your review above)
                  </label>
                  <textarea
                    value={privateFeedbackText}
                    onChange={(e) => setPrivateFeedbackText(e.target.value)}
                    rows={3}
                    placeholder="Anything you'd like them to know..."
                    className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none resize-none"
                  />
                  <input
                    value={privateFeedbackContact}
                    onChange={(e) => setPrivateFeedbackContact(e.target.value)}
                    placeholder="Your phone or email (optional, if you'd like a reply)"
                    className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={sendPrivateFeedback}
                    loading={sendingPrivateFeedback}
                    disabled={!privateFeedbackText.trim() || privateFeedbackSent}
                  >
                    <Send className="w-3.5 h-3.5" /> {privateFeedbackSent ? 'Sent' : 'Send privately'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="text-center pt-8">
            <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center mx-auto mb-5">
              <Check className="w-7 h-7 text-brand" />
            </div>
            <h2 className="font-display text-2xl font-semibold mb-2">All set</h2>
            <p className="text-sm text-ink-soft mb-1 max-w-xs mx-auto">
              Your review is copied, and we opened Google's review page in a new tab.
            </p>
            <p className="text-sm text-ink-soft mb-8 max-w-xs mx-auto">Just paste and submit — thank you!</p>
            <Button variant="ghost" onClick={reset}>
              <Copy className="w-4 h-4" /> Leave another
            </Button>
          </div>
        )}
      </main>

      <footer className="text-center text-[11px] text-ink-soft py-5">Powered by {branding.productName}</footer>
    </div>
  );
}
