import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogIn } from 'lucide-react';
import { Card, Badge } from '../../components/ui';
import { Button } from '../../components/Button';
import { adminApi, authApi } from '../../lib/api';
import { useToast } from '../../lib/toast';

const PLANS = ['trial', 'starter', 'growth', 'pro'];

export default function AdminBusinessDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  const [business, setBusiness] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [editingLocation, setEditingLocation] = useState<number | null>(null);
  const [editAddress, setEditAddress] = useState('');
  const [editReviewLink, setEditReviewLink] = useState('');
  const [editManagerPhone, setEditManagerPhone] = useState('');
  const [editAutoReply, setEditAutoReply] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    const data = await adminApi.getBusiness(Number(id));
    setBusiness(data.business);
    setLocations(data.locations);
    setUsers(data.users);
    setSubscription(data.subscription);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function startEditing(loc: any) {
    setEditingLocation(loc.id);
    setEditAddress(loc.address || '');
    setEditReviewLink(loc.googleReviewLink || '');
    setEditManagerPhone(loc.managerPhone || '');
    setEditAutoReply(Boolean(loc.dmAutoReplyEnabled));
  }

  async function saveLocation(locId: number) {
    if (!id) return;
    setSaving(true);
    try {
      await adminApi.updateLocation(Number(id), locId, {
        address: editAddress,
        googleReviewLink: editReviewLink,
        managerPhone: editManagerPhone,
        dmAutoReplyEnabled: editAutoReply,
      });
      showSuccess('Saved.');
      setEditingLocation(null);
      await load();
    } catch {
      showError('Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function changePlan(plan: string) {
    if (!id) return;
    try {
      await adminApi.updatePlan(Number(id), plan);
      showSuccess(`Plan changed to ${plan}.`);
      await load();
    } catch {
      showError('Could not change plan.');
    }
  }

  async function impersonate() {
    if (!id) return;
    try {
      const { token, businessName } = await adminApi.impersonate(Number(id));
      authApi.startImpersonation(token, businessName);
      navigate('/dashboard');
    } catch {
      showError('Could not log in as this client.');
    }
  }

  if (loading || !business) {
    return <div className="p-8 text-sm text-ink-soft">Loading...</div>;
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <button onClick={() => navigate('/admin')} className="flex items-center gap-1.5 text-xs text-ink-soft mb-4">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to all businesses
      </button>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold">{business.name}</h1>
        <Button size="sm" onClick={impersonate}>
          <LogIn className="w-3.5 h-3.5" /> Login as this client
        </Button>
      </div>

      <Card className="mb-6">
        <h2 className="font-semibold text-sm mb-3">Plan</h2>
        <div className="flex gap-2 flex-wrap">
          {PLANS.map((p) => (
            <button
              key={p}
              onClick={() => changePlan(p)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border capitalize ${
                subscription?.plan === p ? 'bg-brand-soft text-brand border-transparent' : 'border-line text-ink-soft'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="font-semibold text-sm mb-3">Users ({users.length})</h2>
        <div className="space-y-1">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between text-sm py-1">
              <span>{u.email}</span>
              <Badge>{u.role}</Badge>
            </div>
          ))}
        </div>
      </Card>

      <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">
        Locations ({locations.length})
      </h2>
      <div className="space-y-3">
        {locations.map((loc) => (
          <Card key={loc.id}>
            {editingLocation === loc.id ? (
              <div className="space-y-2">
                <input
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  placeholder="Address"
                  className="w-full border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
                />
                <input
                  value={editReviewLink}
                  onChange={(e) => setEditReviewLink(e.target.value)}
                  placeholder="Google review link"
                  className="w-full border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
                />
                <input
                  value={editManagerPhone}
                  onChange={(e) => setEditManagerPhone(e.target.value)}
                  placeholder="Manager phone"
                  className="w-full border border-line rounded-lg p-2 text-sm focus:border-brand outline-none"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={editAutoReply} onChange={(e) => setEditAutoReply(e.target.checked)} />
                  DM auto-reply enabled
                </label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => saveLocation(loc.id)} loading={saving}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingLocation(null)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{loc.address || `Location #${loc.id}`}</div>
                  <div className="text-xs text-ink-soft">
                    {loc.postproxyProfileGroupId ? 'Connected' : 'Not connected'} ·{' '}
                    {loc.dmAutoReplyEnabled ? 'Auto-reply on' : 'Auto-reply off'}
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={() => startEditing(loc)}>Edit</Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
