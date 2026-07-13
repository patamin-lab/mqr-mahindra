import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { InspectionService, type InspectionStatus } from '@/features/inspection';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import SearchToolbar from '@/components/shared/layout/SearchToolbar';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';

const service = new InspectionService();
const STATUSES: InspectionStatus[] = ['Scheduled', 'InProgress', 'Completed', 'Cancelled'];

/**
 * PDI list (ADR-017). Screen Contract: Purpose - find a PDI Inspection by
 * status/serial/technician. Primary User - Technician (create/edit),
 * Dealer Admin (approve). Primary Decision - "is this vehicle ready for
 * delivery." Primary Action - open an inspection, or start a new one.
 * Permissions - every authenticated role may view/create; Dealer Approval
 * is gated on the detail screen by `canApproveDelivery`.
 */
export default async function PdiListPage({ searchParams }: { searchParams: { status?: string; q?: string } }) {
  const session = await getSession();
  if (!session) return null;

  const status = STATUSES.includes(searchParams.status as InspectionStatus) ? (searchParams.status as InspectionStatus) : undefined;
  const inspections = await service.listInspections({ status, q: searchParams.q });
  const clearHref = searchParams.q || searchParams.status ? '/delivery/pdi' : undefined;

  return (
    <div>
      <PageHeader
        title={t('pdi.title')}
        subtitle={t('pdi.subtitle')}
        titleClassName="text-2xl font-bold text-brand-dark"
        className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
        actions={
          <Link href="/delivery/pdi/new" className="btn-primary">
            {t('pdi.newAction')}
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
          <input name="q" defaultValue={searchParams.q ?? ''} placeholder={t('pdi.searchPlaceholder')} className="w-64 rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('pdi.statusLabel')}</label>
          <select name="status" defaultValue={searchParams.status ?? ''} className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">{t('pdi.statusAllLabel')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`pdi.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
      </SearchToolbar>

      {inspections.length === 0 ? (
        <EmptyState icon="📋" title={t('pdi.title')} reason={t('pdi.emptyListReason')} nextStep={t('pdi.emptyListNextStep')} />
      ) : (
        <Card variant="elevated" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">{t('pdi.inspectionRefLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.serialLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.technicianLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.statusLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.resultLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inspections.map((i) => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">
                    <Link href={`/delivery/pdi/${i.id}`} className="text-brand-red hover:underline">
                      {i.inspectionRef}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{i.serial}</td>
                  <td className="px-4 py-3 text-gray-500">{i.technicianName}</td>
                  <td className="px-4 py-3">{t(`pdi.status.${i.status}`)}</td>
                  <td className="px-4 py-3 text-gray-500">{i.result ? t(`pdi.result.${i.result}`) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
