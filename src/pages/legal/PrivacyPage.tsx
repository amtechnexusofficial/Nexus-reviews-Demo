import { branding } from '../../config/branding';

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 py-10 prose prose-sm">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-8 text-sm text-warning not-prose">
        <strong>Template only — not legal advice.</strong> Customize this to reflect what you actually
        collect and how you actually use it, and have it reviewed before relying on it — especially if you
        collect customer data (like kiosk review sessions) across multiple jurisdictions (GDPR, CCPA, etc.).
      </div>

      <h1 className="font-display text-2xl font-semibold mb-4">Privacy Policy</h1>
      <p className="text-sm text-ink-soft mb-6">Last updated: [DATE]</p>

      <div className="space-y-5 text-sm leading-relaxed text-ink">
        <section>
          <h2 className="font-semibold mb-1">1. What we collect</h2>
          <p>
            Business owner accounts: email, password (hashed, never stored in plain text), business name
            and location details. Customer kiosk sessions: star rating, free-text answers to review
            questions, and the AI-generated draft — no account or login is required from customers.
          </p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">2. How we use it</h2>
          <p>
            To operate the service: syncing and displaying reviews, generating AI drafts and insights, and
            sending review requests you initiate. We don't sell customer or business data to third parties.
          </p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">3. Third-party processors</h2>
          <p>
            Data passes through: Google Gemini (AI generation), ReviewHook (Google/Yelp/Trustpilot review data),
            Neon (database hosting), Cloudflare (application hosting), and — if configured — Twilio/Resend
            (message delivery) and Google Places (competitor lookups). Each has its own privacy practices.
          </p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">4. Data retention</h2>
          <p>[Placeholder — define how long you keep kiosk sessions, chat history, and screening logs.]</p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">5. Your rights</h2>
          <p>[Placeholder — access/deletion rights depend on your users' jurisdiction; GDPR/CCPA have specific requirements.]</p>
        </section>
        <section>
          <h2 className="font-semibold mb-1">6. Contact</h2>
          <p>Questions about this policy: {branding.supportEmail}</p>
        </section>
      </div>
    </div>
  );
}
