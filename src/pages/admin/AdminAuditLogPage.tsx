import { useEffect, useState } from 'react';
import { Card, Badge } from '../../components/ui';
import { adminApi } from '../../lib/api';

export default function AdminAuditLogPage() {
  const [log, setLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.auditLog().then((r) => {
      setLog(r.log);
      setLoading(false);
    });
  }, []);

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-1">Audit Log</h1>
      <p className="text-sm text-ink-soft mb-6">Every admin action — impersonation, deletions, settings changes.</p>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading...</p>
      ) : log.length === 0 ? (
        <p className="text-sm text-ink-soft">No admin actions yet.</p>
      ) : (
        <div className="space-y-2">
          {log.map((entry) => (
            <Card key={entry.id} className="py-3">
              <div className="flex items-center justify-between mb-1">
                <Badge tone={entry.action === 'delete_business' ? 'danger' : entry.action === 'impersonate' ? 'warning' : 'neutral'}>
                  {entry.action.replace('_', ' ')}
                </Badge>
                <span className="text-xs text-ink-soft">{new Date(entry.createdAt).toLocaleString()}</span>
              </div>
              {entry.details && <p className="text-xs text-ink-soft">{entry.details}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
