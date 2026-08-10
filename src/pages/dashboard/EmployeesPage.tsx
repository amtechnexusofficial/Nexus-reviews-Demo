import { useEffect, useState } from 'react';
import { Trash2, Sparkles, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Card, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { employeesApi, Employee, EmployeeMention } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';

export default function EmployeesPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess, showError } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [adding, setAdding] = useState(false);
  const [mentions, setMentions] = useState<EmployeeMention[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  async function load() {
    if (!locationId) return;
    const { employees } = await employeesApi.list(locationId);
    setEmployees(employees);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function addEmployee() {
    if (!locationId || !name.trim()) return;
    setAdding(true);
    try {
      await employeesApi.create({ locationId, name, role });
      setName('');
      setRole('');
      await load();
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: number) {
    await employeesApi.remove(id);
    await load();
  }

  async function analyze() {
    if (!locationId) return;
    setAnalyzing(true);
    try {
      const { mentions } = await employeesApi.mentions(locationId);
      setMentions(mentions);
      showSuccess(mentions.length > 0 ? `Found mentions for ${mentions.length} team member(s).` : 'No mentions found in current reviews.');
    } catch {
      showError('Analysis failed — try again in a moment.');
    } finally {
      setAnalyzing(false);
    }
  }

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-semibold">Team</h1>
        <Button size="sm" onClick={analyze} loading={analyzing} disabled={employees.length === 0}>
          <Sparkles className="w-3.5 h-3.5" /> Analyze mentions
        </Button>
      </div>
      <p className="text-sm text-ink-soft mb-6">Add your team, then see who's mentioned in reviews and how.</p>

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none"
          />
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Role (e.g. Server)"
            className="border border-line rounded-lg p-2.5 text-sm focus:border-brand outline-none"
          />
        </div>
        <Button size="sm" onClick={addEmployee} loading={adding} disabled={!name.trim()}>
          Add team member
        </Button>
      </Card>

      {employees.length === 0 ? (
        <EmptyState title="No team members added" body="Add names above to start tracking mentions." />
      ) : (
        <div className="space-y-2 mb-6">
          {employees.map((e) => {
            const mention = mentions.find((m) => m.name.toLowerCase() === e.name.toLowerCase());
            return (
              <Card key={e.id} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{e.name}</div>
                    {e.role && <div className="text-xs text-ink-soft">{e.role}</div>}
                  </div>
                  <div className="flex items-center gap-3">
                    {mention && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-1 text-success"><ThumbsUp className="w-3 h-3" /> {mention.positiveMentions}</span>
                        <span className="flex items-center gap-1 text-danger"><ThumbsDown className="w-3 h-3" /> {mention.negativeMentions}</span>
                      </div>
                    )}
                    <button onClick={() => remove(e.id)} className="text-ink-soft hover:text-danger">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {mention && mention.examples.length > 0 && (
                  <ul className="mt-2 pt-2 border-t border-line space-y-1">
                    {mention.examples.map((ex, i) => (
                      <li key={i} className="text-xs text-ink-soft italic">"{ex}"</li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
