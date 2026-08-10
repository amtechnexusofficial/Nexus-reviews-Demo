import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, LogIn, ExternalLink } from 'lucide-react';
import { Card, Badge } from '../../components/ui';
import { Button } from '../../components/Button';
import { adminApi, AdminBusinessSummary, authApi } from '../../lib/api';
import { useToast } from '../../lib/toast';

export default function AdminBusinessesPage() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();
  const [businesses, setBusinesses] = useState<AdminBusinessSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newReviewLink, setNewReviewLink] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; tempPassword: string } | null>(null);

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [impersonatingId, setImpersonatingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const { businesses } = await adminApi.listBusinesses();
    setBusinesses(businesses.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createBusiness() {
    if (!newName.trim() || !newEmail.trim()) return;
    setCreating(true);
    try {
      const res = await adminApi.createBusiness({
        businessName: newName,
        email: newEmail,
        address: newAddress || undefined,
        googleReviewLink: newReviewLink || undefined,
      });
      setCreatedCreds({ email: res.user.email, tempPassword: res.tempPassword });
      setNewName('');
      setNewEmail('');
      setNewAddress('');
      setNewReviewLink('');
      await load();
    } catch (e: any) {
      showError(e.message || 'Could not create business.');
    } finally {
      setCreating(false);
    }
  }

  async function deleteBusiness(id: number, name: string) {
    if (!confirm(`Permanently delete "${name}" and all its data? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await adminApi.deleteBusiness(id);
      showSuccess(`Deleted "${name}".`);
      await load();
    } catch {
      showError('Delete failed.');
    } finally {
      setDeletingId(null);
    }
  }

  async function impersonate(id: number, name: string) {
    setImpersonatingId(id);
    try {
      const { token, businessName } = await adminApi.impersonate(id);
      authApi.startImpersonation(token, businessName);
      navigate('/dashboard');
    } catch {
      showError('Could not log in as this client.');
    } finally {
      setImpersonatingId(null);
    }
  }

  return (
    <div className="p-5 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold">Client Businesses</h1>
        <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="w-3.5 h-3.5" /> Add client
        </Button>
      </div>
      <p className="text-sm text-ink-soft mb-6">{businesses.length} businesses total</p>

      {showCreate && (
        <Card className="mb-6">
          <h2 className="font-semibold text-sm mb-3">New client</h2>
          {createdCreds ? (
            <div className="bg-brand-soft border border-brand/20 rounded-lg p-3 mb-3">
              <p className="text-sm font-medium text-brand mb-1">Account created — share these once:</p>
              <p className="text-xs text-ink">Email: {createdCreds.email}</p>
              <p className="text-xs text-ink">Temp password: <code className="bg-white px-1.5 py-0.5 rounded">{createdCreds.tempPassword}</code></p>
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setCreatedCreds(null)}>
                Add another
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Business name" className="col-span-2 border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none" />
                <input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Client's login email" className="col-span-2 border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none" />
                <input value={newAddress} onChange={(e) => setNewAddress(e.target.value)} placeholder="Address (optional)" className="border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none" />
                <input value={newReviewLink} onChange={(e) => setNewReviewLink(e.target.value)} placeholder="Google review link (optional)" className="border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none" />
              </div>
              <Button size="sm" onClick={createBusiness} loading={creating} disabled={!newName.trim() || !newEmail.trim()}>
                Create
              </Button>
            </>
          )}
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-ink-soft">Loading...</p>
      ) : (
        <div className="space-y-2">
          {businesses.map((b) => (
            <Card key={b.id} className="py-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-[160px]">
                  <div className="font-medium text-sm">{b.name}</div>
                  <div className="text-xs text-ink-soft">
                    {b.locationCount} location{b.locationCount !== 1 ? 's' : ''} · {b.reviewCount} reviews ·{' '}
                    {b.connectedLocations} connected
                  </div>
                </div>
                <Badge tone={b.subscriptionStatus === 'active' ? 'success' : 'neutral'}>{b.plan}</Badge>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/businesses/${b.id}`)}>
                    Manage
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => impersonate(b.id, b.name)} loading={impersonatingId === b.id}>
                    <LogIn className="w-3.5 h-3.5" /> Login as
                  </Button>
                  <button
                    onClick={() => deleteBusiness(b.id, b.name)}
                    disabled={deletingId === b.id}
                    className="text-ink-soft hover:text-danger disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
