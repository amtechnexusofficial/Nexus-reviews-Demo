import { branding } from '../../config/branding';

export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10 prose prose-sm">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-sm text-warning not-prose">
        <strong>Template only — not legal advice.</strong> This is placeholder text to fill the page
        structure. Have an actual lawyer review and customize this before relying on it for a real
        business, especially the sections on liability, data handling, and dispute resolution.
      </div>

      <h1 className="font-display text-2xl font-semibold mb-4">Terms of Service</h1>
      <p className="text-sm text-ink-soft mb-6">Last updated: [DATE]</p>

      <div className="space-y-5 text-sm leading-relaxed text-ink">
        <section>
          <h2 className="font-semibold mb-1">1. Acceptance of terms</h2>
          <p>By using {branding.productName}, you agree to these terms. If you don't agree, don't use the service.</p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">2. What the service does</h2>
          <p>
            {branding.productName} helps businesses collect, monitor, and respond to customer reviews,
            including AI-assisted drafting of review text and reply suggestions. You are responsible for
            the accuracy of any content you post or approve using the service.
          </p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">3. Your account</h2>
          <p>You're responsible for keeping your login credentials secure and for all activity under your account.</p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">4. Acceptable use</h2>
          <p>
            You agree not to use this service to generate fake, incentivized, or misleading reviews, or to
            suppress genuine negative feedback from public view. [Customize based on your actual policies
            and applicable law, e.g. the FTC's rules on fake/manipulated reviews.]
          </p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">5. Third-party services</h2>
          <p>
            This service integrates with third parties (e.g. Google, ReviewHook, Google Gemini) to function.
            We aren't responsible for their availability, accuracy, or policies.
          </p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">6. Limitation of liability</h2>
          <p>[Placeholder — needs real legal drafting specific to your jurisdiction and business structure.]</p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">7. Changes to these terms</h2>
          <p>We may update these terms; continued use after changes means you accept the update.</p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">8. Contact</h2>
          <p>Questions about these terms: {branding.supportEmail}</p>
        </section>
      </div>
    </div>
  );
}
