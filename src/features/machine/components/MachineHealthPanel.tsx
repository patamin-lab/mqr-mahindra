import Card from '@/components/shared/layout/Card';
import HealthCard from '@/components/shared/dashboard/HealthCard';
import type { HealthStatus as HealthCardStatus } from '@/components/shared/dashboard/HealthCard';
import { t } from '@/lib/i18n/server';
import { MachineSummary } from '../types';

/**
 * Machine Digital Passport v1.1 refinement - Machine Health section.
 * Reuses the platform's one Health Card widget (MSEAL Design Framework,
 * ADR-023, Widget Guidelines - "don't create an eighth widget type"),
 * fed by the exact same `healthScore`/`healthStatus` signal Vehicle 360
 * already computes on `MachineSummary` - zero new query, on the page's
 * fast core fetch path (no `<Suspense>` needed).
 *
 * `HealthCard`'s status vocabulary (healthy/degraded/down/unknown) is
 * fixed per the Widget Guidelines - `MachineSummary.healthStatus`'s own
 * vocabulary (excellent/good/attention/critical) is mapped onto it here
 * rather than widening `HealthCard` to a fifth status. This single
 * computed score is today's whole "Machine Health" - a fuller Machine
 * Health capability (trend over time, sensor-driven inputs once Future
 * IoT lands, predictive scoring) is the future capability this section
 * is reserved to grow into; see
 * `docs/architecture/MACHINE_PASSPORT_ARCHITECTURE.md`.
 */
const STATUS_MAP: Record<MachineSummary['healthStatus'], HealthCardStatus> = {
  excellent: 'healthy',
  good: 'healthy',
  attention: 'degraded',
  critical: 'down',
};

export default function MachineHealthPanel({ summary }: { summary: MachineSummary }) {
  return (
    <Card variant="compact" className="p-6" as="section" id="health">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.healthTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HealthCard
          label={t('common.healthScore')}
          status={STATUS_MAP[summary.healthStatus]}
          statusLabel={t(`health.${summary.healthStatus}`)}
          detail={String(summary.healthScore)}
        />
      </div>
      <p className="mt-3 text-xs text-gray-400">{t('machinePassport.healthFutureNote')}</p>
    </Card>
  );
}
