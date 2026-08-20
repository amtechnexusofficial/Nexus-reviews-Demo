import { useEffect, useState } from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { Card, EmptyState } from '../../components/ui';
import { Button } from '../../components/Button';
import { analyticsApi, AnalyticsSnapshot } from '../../lib/api';
import { useActiveLocation } from '../../lib/useLocation';
import { useToast } from '../../lib/toast';

const MAX_REPORTS = 4;

function formatReportDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function escapePdfText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function downloadInsightPdf(snapshot: AnalyticsSnapshot) {
  const lines = [
    `Insights — ${snapshot.periodLabel}`,
    `Generated: ${new Date(snapshot.createdAt).toLocaleString()}`,
    `Reviews analyzed: ${snapshot.reviewCountAnalyzed}`,
    '',
    snapshot.summary,
    '',
    ...(snapshot.recommendations.length
      ? ['Recommendations:', ...snapshot.recommendations.map((r, i) => `${i + 1}. ${r}`)]
      : []),
  ];

  const contentLines = lines.flatMap((line) => {
    // Wrap long lines roughly for the PDF page width.
    const chunks: string[] = [];
    let remaining = line;
    while (remaining.length > 90) {
      chunks.push(remaining.slice(0, 90));
      remaining = remaining.slice(90);
    }
    chunks.push(remaining);
    return chunks;
  });

  const textOps = contentLines
    .map((line, i) =>
      i === 0
        ? `BT /F1 12 Tf 50 740 Td (${escapePdfText(line)}) Tj`
        : `0 -16 Td (${escapePdfText(line)}) Tj`
    )
    .join('\n');
  const stream = `${textOps}\nET`;

  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj',
    `4 0 obj<< /Length ${stream.length} >>stream\n${stream}\nendstream endobj`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(pdf.length);
    pdf += obj + '\n';
  }
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `insights-${formatReportDate(snapshot.createdAt).replace(/\//g, '-')}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AnalyticsPage() {
  const { locationId } = useActiveLocation();
  const { showSuccess } = useToast();
  const [snapshots, setSnapshots] = useState<AnalyticsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    analyticsApi.list(locationId).then(({ snapshots }) => {
      setSnapshots(snapshots.slice(0, MAX_REPORTS));
      setLoading(false);
    });
  }, [locationId]);

  if (!locationId) {
    return <EmptyState title="No business connected" body="Connect a business in Settings first." />;
  }

  const latest = snapshots[0];
  const previous = snapshots.slice(1);
  const keptCount = snapshots.length;

  function handlePdf(snapshot: AnalyticsSnapshot) {
    downloadInsightPdf(snapshot);
    showSuccess('PDF downloaded.');
  }

  return (
    <div className="p-5 md:p-8 max-w-2xl mx-auto">
      <h1 className="font-display text-2xl font-semibold mb-1">Insights</h1>
      <p className="text-sm text-ink-soft mb-6">
        Latest report opens here automatically. A 30-day report runs every Monday (08:00 UTC). Up to 4 PDFs
        are kept; older ones are removed.
      </p>

      {loading ? (
        <p className="text-sm text-ink-soft">Loading...</p>
      ) : !latest ? (
        <EmptyState
          title="No insights generated yet"
          body="Your next scheduled Monday report will appear here automatically."
        />
      ) : (
        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">
              Latest insights
            </h2>
            <Card>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <TrendingUp className="w-4 h-4 text-brand shrink-0" />
                  <span className="text-xs font-semibold text-brand/80 uppercase tracking-wide">
                    {latest.periodLabel} · {latest.reviewCountAnalyzed} reviews analyzed ·{' '}
                    {formatReportDate(latest.createdAt)}
                  </span>
                </div>
                <Button size="sm" variant="secondary" onClick={() => handlePdf(latest)}>
                  <Download className="w-3.5 h-3.5" /> PDF
                </Button>
              </div>
              <p className="text-sm leading-relaxed">{latest.summary}</p>
              {latest.recommendations.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {latest.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-relaxed">
                      <span className="text-brand font-semibold shrink-0">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {previous.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink-soft uppercase tracking-wide mb-3">
                Previous reports ({previous.length}/{MAX_REPORTS - 1})
              </h2>
              <div className="space-y-3">
                {previous.map((s) => (
                  <Card key={s.id} className="py-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="text-xs text-ink-soft">
                        {formatReportDate(s.createdAt)} · {s.periodLabel}
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => handlePdf(s)}>
                        <Download className="w-3.5 h-3.5" /> PDF
                      </Button>
                    </div>
                    <p className="text-sm leading-relaxed">{s.summary}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {keptCount > 0 && previous.length === 0 && (
            <p className="text-xs text-ink-soft">Older reports will appear here (up to {MAX_REPORTS - 1} kept).</p>
          )}
        </div>
      )}
    </div>
  );
}
