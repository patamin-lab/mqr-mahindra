import { getSession } from '@/lib/auth';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { InspectionService } from '@/features/inspection';
import { canAccessImportInspection } from '@/lib/scope';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';

const service = new InspectionService();

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card variant="flat" className="p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-dark">{value}</p>
    </Card>
  );
}

/**
 * Import Inspection Dashboard (ADR-017, business-domain correction) - the
 * internal MSEAL dashboard, renamed and scoped from the general Delivery
 * Dashboard (`docs/architecture/DELIVERY_PLATFORM.md`). MSEAL-only
 * (`canAccessImportInspection`). Eight of the ten officially named KPIs
 * are real and live-computed (`InspectionService.getDashboardStats()`,
 * JS-side aggregation - not a second reporting engine). Findings by
 * Model / Findings by Factory have no data model yet and are rendered as
 * reserved, Coming Soon tiles - never a fabricated number.
 */
export default async function ImportInspectionDashboardPage() {
  const session = await getSession();
  if (!session) return null;
  if (!canAccessImportInspection(session.role)) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('pdi.dashboardTitle')} />
        <EmptyState icon="🔒" title={t('pdi.forbiddenTitle')} reason={t('pdi.forbiddenReason')} nextStep={t('pdi.forbiddenNextStep')} />
      </div>
    );
  }

  const scope = resolveDealerScope(session, null);
  const stats = await service.getDashboardStats(session, scope.dealerId ?? undefined);

  return (
    <div className="space-y-4">
      <PageHeader title={t('pdi.dashboardTitle')} subtitle={t('pdi.dashboardSubtitle')} titleClassName="text-2xl font-bold text-brand-dark" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label={t('pdi.pendingImportInspectionLabel')} value={stats.pendingImportInspection} />
        <KpiCard label={t('pdi.pendingRePdiLabel')} value={stats.pendingRePdi} />
        <KpiCard label={t('pdi.expiredInspectionLabel')} value={stats.expiredInspection} />
        <KpiCard label={t('pdi.releasedToDealerLabel')} value={stats.releasedToDealer} />
        <KpiCard label={t('pdi.criticalFindingsLabel')} value={stats.criticalFindings} />
        <KpiCard label={t('pdi.factoryFeedbackPendingLabel')} value={stats.factoryFeedbackPending} />
        <KpiCard label={t('pdi.averageInspectionTimeLabel')} value={stats.averageInspectionHours !== null ? `${stats.averageInspectionHours} ${t('unit.hours')}` : 'N/A'} />
        <KpiCard label={t('pdi.inspectionPassRateLabel')} value={stats.inspectionPassRate !== null ? `${stats.inspectionPassRate}%` : 'N/A'} />
      </div>

      <Card variant="compact" className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('pdi.reservedKpiTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <EmptyState icon="📌" title={t('pdi.findingsByModelLabel')} reason={t('pdi.reservedKpiReason')} nextStep={t('pdi.reservedKpiNextStep')} comingSoon />
          <EmptyState icon="📌" title={t('pdi.findingsByFactoryLabel')} reason={t('pdi.reservedKpiReason')} nextStep={t('pdi.reservedKpiNextStep')} comingSoon />
        </div>
      </Card>
    </div>
  );
}
