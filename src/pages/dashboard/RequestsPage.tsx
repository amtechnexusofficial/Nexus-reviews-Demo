import { useEffect, useState } from 'react';
import { Send, AlertTriangle } from 'lucide-react';
import { Card, Badge, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { requestsApi, ReviewRequest } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';

export default function RequestsPage() {
  const { locationId } = useActiveLocation();
  const [requests, setRequests] = useState<ReviewRequest[]>([]);
  const [status, setStatus] = useState<{ smsConfigured: boolean; emailConfigured: boolean } | null>(null);
  const [channel, setChannel] = useState<'sms' | 'email'>('email');
  const [contact, setContact] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState('');

  async function load() {
    if (!locationId) return;
    const { requests } = await requestsApi.list(locationId);
    setRequests(requests);
  }

  useEffect(() => {
    requestsApi.status().then(setStatus);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function queueRequest() {
    if (!locationId || !contact.trim()) return;
    setSending(true);
    setNote('');
    try {
      const res = await requestsApi.create({ locationId, channel, customerContact: contact, customerName });
      setNote(res.delivered ? 'Sent!' : `Queued — ${res.reason}`);
      setContact('');
      setCustomerName('');
      await load();
    } finally {
      setSending(false);
    }
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  const channelReady = channel === 'sms' ? status?.smsConfigured : status?.emailConfigured;

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-1">Review Requests</h1>
      <p className="text-sm text-ink-soft mb-6">Queue a request to a customer, one at a time.</p>

      {status && !status.smsConfigured && !status.emailConfigured && (
        <div className="flex gap-2.5 items-start bg-amber-50 border border-amber-200 rounded-lg p-3.5 mb-6">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-xs text-warning leading-relaxed">
            No SMS or email provider connected yet — requests will be queued and tracked here, but not actually
            delivered until Twilio (SMS) or Resend (email) API keys are added. See <code>services/notifications.ts</code>.
          </p>
        </div>
      )}

      <Card className="mb-6">
        <div className="flex gap-2 mb-3">
          {(['email', 'sms'] as const).map((ch) => (
            <button
              key={ch}
              onClick={() => setChannel(ch)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                channel === ch ? 'bg-brand-soft text-brand border-transparent' : 'border-line text-ink-soft'
              }`}
            >
              {ch === 'email' ? 'Email' : 'SMS'}
            </button>
          ))}
          {!channelReady && <Badge tone="warning">Not delivering yet</Badge>}
        </div>
        <input
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
          placeholder="Customer name (optional)"
          className="w-full border border-line rounded-lg p-2.5 text-sm mb-2 focus:border-brand outline-none"
        />
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder={channel === 'email' ? 'customer@email.com' : '+1 555 000 0000'}
          className="w-full border border-line rounded-lg p-2.5 text-sm mb-3 focus:border-brand outline-none"
        />
        <Button onClick={queueRequest} loading={sending} disabled={!contact.trim()}>
          <Send className="w-4 h-4" /> Queue request
        </Button>
        {note && <p className="text-xs text-ink-soft mt-2">{note}</p>}
      </Card>

      <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">History</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-ink-soft">No requests queued yet.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <Card key={r.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium">{r.customerName || r.customerContact}</div>
                <div className="text-xs text-ink-soft">{r.channel.toUpperCase()} · {new Date(r.createdAt).toLocaleDateString()}</div>
              </div>
              <Badge tone={r.status === 'sent' ? 'success' : r.status === 'failed' ? 'danger' : 'neutral'}>
                {r.status}
              </Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
