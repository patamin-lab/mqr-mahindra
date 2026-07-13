import { getSession } from '@/lib/auth';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { canExport } from '@/lib/scope';
import { DeliveryService } from '@/features/delivery';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import SearchToolbar from '@/components/shared/layout/SearchToolbar';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';

const service = new DeliveryService();

interface ReportSearchParams {
  technicianName?: string;
  model?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Delivery Reports (ADR-027, Output #9). One consolidated dataset
 * satisfying all 7 named report types (Dealer/Technician/Model/Checklist
 * Version/Delivery Duration/Training Completion/Warranty Activation) as
 * filters/columns of one report - Reuse-before-Build, not 7 separate
 * report pipelines. CSV export reuses the existing shared `buildCsv()`.
 */
export default async function DeliveryReportsPage({ searchParams }: { searchParams: ReportSearchParams }) {
  const session = await getSession();
  if (!session) return null;

  const scope = resolveDealerScope(session, null);
  const rows = await service.getDeliveryReport({
    dealerId: scope.dealerId ?? undefined,
    technicianName: searchParams.technicianName,
    model: searchParams.model,
    dateFrom: searchParams.dateFrom,
    dateTo: searchParams.dateTo,
  });

  const csvQuery = new URLSearchParams({ format: 'csv', ...searchParams }).toString();
  const clearHref = Object.values(searchParams).some(Boolean) ? '/delivery/reports' : undefined;

  return (
    <div>
      <PageHeader
        title={t('delivery.reportsTitle')}
        subtitle={t('delivery.reportsSubtitle')}
        titleClassName="text-2xl font-bold text-brand-dark"
        className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
        actions={
          canExport(session.role) ? (
            <a href={`/api/delivery/report?${csvQuery}`} className="btn-primary">
              {t('delivery.exportCsvAction')}
            </a>
          ) : undefined
        }
      />

      <SearchToolbar
        cardClassName="mb-4 flex flex-wrap items-end gap-3 p-4"
        filterLabel={t('common.filter')}
        filterButtonClassName="rounded border border-gray-300 bg-gray-50 px-4 py-2 text-sm transition hover:bg-gray-100"
        clearHref={clearHref}
        clearLabel={t('common.clearFilter')}
      >
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.filterTechnicianLabel')}</label>
          <input name="technicianName" defaultValue={searchParams.technicianName ?? ''} className="w-40 rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.filterModelLabel')}</label>
          <input name="model" defaultValue={searchParams.model ?? ''} className="w-40 rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.filterDateFromLabel')}</label>
          <input name="dateFrom" type="date" defaultValue={searchParams.dateFrom ?? ''} className="rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.filterDateToLabel')}</label>
          <input name="dateTo" type="date" defaultValue={searchParams.dateTo ?? ''} className="rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </SearchToolbar>

      {rows.length === 0 ? (
        <EmptyState icon="📊" title={t('delivery.reportsTitle')} reason={t('delivery.emptyListReason')} nextStep={t('delivery.emptyListNextStep')} />
      ) : (
        <Card variant="elevated" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">{t('delivery.deliveryRefLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.serialLabel')}</th>
                <th className="px-4 py-3 text-left">{t('delivery.filterModelLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.technicianLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.checklistVersionLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.resultLabel')}</th>
                <th className="px-4 py-3 text-left">Duration</th>
                <th className="px-4 py-3 text-left">{t('delivery.pendingTrainingLabel')}</th>
                <th className="px-4 py-3 text-left">{t('delivery.warrantyActivatedLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.deliveryRef} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">{r.deliveryRef}</td>
                  <td className="px-4 py-3">{r.serial}</td>
                  <td className="px-4 py-3 text-gray-500">{r.model ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.technicianName ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.checklistVersion ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.pdiResult ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.deliveryDurationDays ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.trainingCompleted ? '✓' : '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{r.warrantyActivated ? '✓' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
