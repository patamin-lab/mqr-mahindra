import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { DeliveryService, DELIVERY_STAGE_ORDER, type DeliveryStage } from '@/features/delivery';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import SearchToolbar from '@/components/shared/layout/SearchToolbar';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';

const service = new DeliveryService();

/**
 * Deliveries list (ADR-027). Screen Contract: Purpose - find a Delivery
 * Record by stage/serial. Primary User - Dealer User/Admin. Primary
 * Decision - "where is this machine in its delivery lifecycle." Primary
 * Action - open a delivery, or start a new one (Tractor In).
 */
export default async function DeliveryListPage({ searchParams }: { searchParams: { stage?: string; q?: string } }) {
  const session = await getSession();
  if (!session) return null;

  const stage = DELIVERY_STAGE_ORDER.includes(searchParams.stage as DeliveryStage) ? (searchParams.stage as DeliveryStage) : undefined;
  const deliveries = await service.listDeliveries({ stage, q: searchParams.q });
  const clearHref = searchParams.q || searchParams.stage ? '/delivery/records' : undefined;

  return (
    <div>
      <PageHeader
        title={t('delivery.title')}
        subtitle={t('delivery.subtitle')}
        titleClassName="text-2xl font-bold text-brand-dark"
        className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
        actions={
          <Link href="/delivery/records/new" className="btn-primary">
            {t('delivery.newAction')}
          </Link>
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
          <label className="mb-1 block text-xs font-medium">{t('common.search')}</label>
          <input name="q" defaultValue={searchParams.q ?? ''} placeholder={t('delivery.searchPlaceholder')} className="w-64 rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('delivery.stageLabel')}</label>
          <select name="stage" defaultValue={searchParams.stage ?? ''} className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">{t('delivery.stageAllLabel')}</option>
            {DELIVERY_STAGE_ORDER.map((s) => (
              <option key={s} value={s}>
                {t(`delivery.stage.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </SearchToolbar>

      {deliveries.length === 0 ? (
        <EmptyState icon="🚚" title={t('delivery.title')} reason={t('delivery.emptyListReason')} nextStep={t('delivery.emptyListNextStep')} />
      ) : (
        <Card variant="elevated" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">{t('delivery.deliveryRefLabel')}</th>
                <th className="px-4 py-3 text-left">{t('delivery.serialLabel')}</th>
                <th className="px-4 py-3 text-left">{t('delivery.stageLabel')}</th>
                <th className="px-4 py-3 text-left">{t('delivery.overallStatusLabel')}</th>
                <th className="px-4 py-3 text-left">{t('delivery.warrantyActivatedLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {deliveries.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">
                    <Link href={`/delivery/records/${d.id}`} className="text-brand-red hover:underline">
                      {d.deliveryRef}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{d.serial}</td>
                  <td className="px-4 py-3">{t(`delivery.stage.${d.stage}`)}</td>
                  <td className="px-4 py-3 text-gray-500">{d.overallStatus}</td>
                  <td className="px-4 py-3 text-gray-500">{d.warrantyActivatedAt ? '✓' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
