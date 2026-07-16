import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { DeliveryService, type DeliveryStage, DELIVERY_STAGE_ORDER } from '@/features/delivery';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import SearchToolbar from '@/components/shared/layout/SearchToolbar';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';

const service = new DeliveryService();

/**
 * Delivery Records list (ADR-027, resurfaced per Production Pilot's
 * "Delivery Records/Detail/Stage Tracking" scope). `DeliveryService.
 * listDeliveries()` is unchanged - this page only resolves dealer scope
 * (`resolveDealerScope()`, the same function every other dealer-owned
 * list page already calls) and renders. `DeliveryRecord` has no
 * `branch_id` column, so scope here is dealer-only.
 */
export default async function DeliveryRecordsListPage({ searchParams }: { searchParams: { stage?: string; q?: string } }) {
  const session = await getSession();
  if (!session) return null;

  const stage = DELIVERY_STAGE_ORDER.includes(searchParams.stage as DeliveryStage) ? (searchParams.stage as DeliveryStage) : undefined;
  const scope = resolveDealerScope(session, null);
  const clearHref = searchParams.q || searchParams.stage ? '/delivery/records' : undefined;

  const records = await service.listDeliveries({
    stage,
    dealerId: scope.dealerId ?? undefined,
    q: searchParams.q,
  });

  return (
    <div>
      <PageHeader
        title={t('delivery.recordsTitle')}
        subtitle={t('delivery.recordsSubtitle')}
        titleClassName="text-2xl font-bold text-brand-dark"
        className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
      />

      <SearchToolbar
        cardClassName="mb-4 flex flex-wrap items-end gap-3 p-4"
        filterLabel={t('common.filter')}
        filterButtonClassName="rounded border border-gray-300 bg-gray-50 px-4 py-2 text-sm transition hover:bg-gray-100"
        clearHref={clearHref}
        clearLabel={t('common.clearFilter')}
      >
        <div>
          <label className="mb-1 block text-xs font-medium">{t('common.search')}</label>
          <input name="q" defaultValue={searchParams.q ?? ''} placeholder={t('delivery.searchPlaceholder')} className="w-64 rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.stageLabel')}</label>
          <select name="stage" defaultValue={stage ?? ''} className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">{t('delivery.stageAllLabel')}</option>
            {DELIVERY_STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {t(`delivery.stage.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </SearchToolbar>

      {records.length === 0 ? (
        <EmptyState icon="🚚" title={t('delivery.recordsTitle')} reason={t('delivery.emptyListReason')} nextStep={t('delivery.emptyListNextStep')} />
      ) : (
        <Card variant="elevated" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">{t('delivery.refLabel')}</th>
                <th className="px-4 py-3 text-left">{t('common.serial')}</th>
                <th className="px-4 py-3 text-left">{t('common.dealer')}</th>
                <th className="px-4 py-3 text-left">{t('delivery.stageLabel')}</th>
                <th className="px-4 py-3 text-left">{t('delivery.overallStatusLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">
                    <Link href={`/delivery/records/${r.id}`} className="text-brand-red hover:underline">
                      {r.deliveryRef}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{r.serial}</td>
                  <td className="px-4 py-3 text-gray-500">{r.dealerId ?? '-'}</td>
                  <td className="px-4 py-3">{t(`delivery.stage.${r.stage}`)}</td>
                  <td className="px-4 py-3 text-gray-500">{t(`delivery.overallStatus.${r.overallStatus}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
