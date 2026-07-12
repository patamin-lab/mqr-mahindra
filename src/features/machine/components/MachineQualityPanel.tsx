import Card from '@/components/shared/layout/Card';
import KpiCard from '@/components/shared/dashboard/KpiCard';
import { t } from '@/lib/i18n/server';
import { MachineQualitySummary } from '../types';

/**
 * Machine Digital Passport - Quality section, backed by
 * `MachineService.getMachineQualitySummary()` (existing `fetchMqrRecords()`
 * + the shared `OPEN_STATUSES` constant - no new query, no new "open" rule).
 * KPI cards reuse the platform's one `KpiCard` (MSEAL Design Framework,
 * ADR-023), the same widget Platform Overview's KPI row uses.
 */
export default function MachineQualityPanel({ quality }: { quality: MachineQualitySummary }) {
  return (
    <Card variant="compact" className="p-6" as="section" id="quality">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.qualityTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label={t('machinePassport.qualityOpen')} value={quality.openCount} />
        <KpiCard label={t('machinePassport.qualityClosed')} value={quality.closedCount} />
        <KpiCard label={t('machinePassport.qualityCritical')} value={quality.criticalCount} accent="text-red-600" />
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('machinePassport.qualityTimelineTitle')}</h3>
      {quality.cases.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-400">{t('machinePassport.noQualityCases')}</p>
      ) : (
        <ul className="space-y-2">
          {quality.cases.map((c) => (
            <li key={c.jobId} className="rounded border border-gray-100 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-brand-dark">{c.jobId}</span>
                <span className="text-xs text-gray-500">{c.status}</span>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {c.severity ?? 'N/A'} · {c.foundDate ?? 'N/A'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
