import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { createNtrService } from '@/features/ntr/factory';
import { parseNtrHistoryFilterFromSearchParams } from '@/features/ntr/utils/parseHistoryFilter';
import { seesAllDealers, canExport } from '@/lib/scope';
import { listDealers, getDealer, getBranchById } from '@/lib/db';
import { formatDateLocalized } from '@/lib/thaiDate';
import { t, getServerLocale } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import SearchToolbar from '@/components/shared/layout/SearchToolbar';
import NtrFilterBar from './NtrFilterBar';

export const dynamic = 'force-dynamic';

export default async function NtrRegistryPage({
  searchParams,
}: {
  searchParams: {
    dealerId?: string;
    branchId?: string;
    model?: string;
    province?: string;
    district?: string;
    retailDateFrom?: string;
    retailDateTo?: string;
    warrantyStatus?: string;
    customerName?: string;
    serial?: string;
    search?: string;
    page?: string;
  };
}) {
  const session = await getSession();
  if (!session) return null;
  const locale = getServerLocale();

  const filter = parseNtrHistoryFilterFromSearchParams(new URLSearchParams(searchParams as Record<string, string>), session);
  const result = await createNtrService().listHistory(filter, session);
  const totalPages = Math.max(Math.ceil(result.total / filter.pageSize), 1);

  // Dealer/Branch Scope Platform Standard: SuperAdmin/CentralAdmin get the
  // full dealer list; branches are resolved client-side by `NtrFilterBar`'s
  // `useDealerBranchScope`, only for whichever dealer is actually known.
  const showDealerField = seesAllDealers(session.role);
  const dealers = showDealerField ? await listDealers() : [];
  const pinnedDealer = !showDealerField && session.dealerId ? await getDealer(session.dealerId) : null;
  const pinnedBranch = session.role === 'DealerUser' && session.branchId ? await getBranchById(session.branchId) : null;
  const allowExport = canExport(session.role);

  const exportQuery = new URLSearchParams();
  if (searchParams.dealerId) exportQuery.set('dealerId', searchParams.dealerId);
  if (searchParams.branchId) exportQuery.set('branchId', searchParams.branchId);
  if (searchParams.model) exportQuery.set('model', searchParams.model);
  if (searchParams.province) exportQuery.set('province', searchParams.province);
  if (searchParams.district) exportQuery.set('district', searchParams.district);
  if (searchParams.retailDateFrom) exportQuery.set('retailDateFrom', searchParams.retailDateFrom);
  if (searchParams.retailDateTo) exportQuery.set('retailDateTo', searchParams.retailDateTo);
  if (searchParams.warrantyStatus) exportQuery.set('warrantyStatus', searchParams.warrantyStatus);
  if (searchParams.customerName) exportQuery.set('customerName', searchParams.customerName);
  if (searchParams.serial) exportQuery.set('serial', searchParams.serial);
  if (searchParams.search) exportQuery.set('search', searchParams.search);
  const exportHref = `/api/ntr-records/export?${exportQuery.toString()}`;

  function pageHref(targetPage: number) {
    const qs = new URLSearchParams(searchParams as Record<string, string>);
    if (targetPage > 1) qs.set('page', String(targetPage));
    else qs.delete('page');
    const s = qs.toString();
    return `/ntr${s ? `?${s}` : ''}`;
  }

  const hasFilters = Boolean(
    searchParams.dealerId ||
      searchParams.branchId ||
      searchParams.model ||
      searchParams.province ||
      searchParams.district ||
      searchParams.retailDateFrom ||
      searchParams.retailDateTo ||
      searchParams.warrantyStatus ||
      searchParams.customerName ||
      searchParams.serial ||
      searchParams.search
  );

  return (
    <div>
      <PageHeader
        title={t('ntr.registryTitle')}
        titleClassName="text-2xl font-bold text-brand-dark"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4"
        actionsClassName="flex flex-wrap items-center gap-2"
        actions={
          <>
            {allowExport && (
              <a href={exportHref} className="btn-secondary">
                {t('common.exportExcel')}
              </a>
            )}
            <Link href="/ntr/new" className="btn-primary">
              + {t('nav.newTractorRegistration')}
            </Link>
          </>
        }
      />

      <SearchToolbar
        cardClassName="p-4 mb-4 flex flex-wrap gap-3 items-end"
        filterLabel={t('common.filter')}
        filterButtonClassName="px-4 py-2 rounded border border-gray-300 text-sm bg-gray-50 hover:bg-gray-100 transition"
        clearHref={hasFilters ? '/ntr' : undefined}
        clearLabel={t('common.clearFilter')}
      >
        <div>
          <label className="block text-xs font-medium mb-1">{t('common.search')}</label>
          <input
            name="search"
            defaultValue={searchParams.search ?? ''}
            placeholder={`${t('csv.ntrNumber')} / ${t('csv.serial')} / ${t('csv.customerName')}`}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-64"
          />
        </div>
        <NtrFilterBar
          role={session.role}
          sessionDealerId={session.dealerId}
          sessionBranchId={session.branchId}
          pinnedDealerName={pinnedDealer?.short_name}
          pinnedBranchName={pinnedBranch?.name}
          initialDealers={dealers}
          initialDealerId={searchParams.dealerId}
          initialBranchId={searchParams.branchId}
          dealerLabel={t('common.dealer')}
          branchLabel={t('common.branch')}
          dealerAllLabel={t('common.allDealers')}
          branchAllLabel={t('common.allBranches')}
        />
        <div>
          <label className="block text-xs font-medium mb-1">{t('csv.province')}</label>
          <input name="province" defaultValue={searchParams.province ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">{`${t('csv.retailDate')} (${t('common.search')})`}</label>
          <div className="flex gap-1">
            <input type="date" name="retailDateFrom" defaultValue={searchParams.retailDateFrom ?? ''} className="border border-gray-300 rounded px-2 py-2 text-sm" />
            <input type="date" name="retailDateTo" defaultValue={searchParams.retailDateTo ?? ''} className="border border-gray-300 rounded px-2 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">{t('csv.warrantyStatus')}</label>
          <select name="warrantyStatus" defaultValue={searchParams.warrantyStatus ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">{t('common.all')}</option>
            <option value="in_warranty">{t('warranty.inWarranty')}</option>
            <option value="out_of_warranty">{t('warranty.outOfWarranty')}</option>
          </select>
        </div>
      </SearchToolbar>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">{t('csv.ntrNumber')}</th>
              <th className="text-left px-4 py-3">{t('ntr.acceptanceDate')}</th>
              <th className="text-left px-4 py-3">{t('csv.serial')} / {t('csv.model')}</th>
              <th className="text-left px-4 py-3">{t('csv.customerName')}</th>
              <th className="text-left px-4 py-3">{t('common.dealer')}</th>
              <th className="text-left px-4 py-3">{t('common.status')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {result.data.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">
                  <Link href={`/ntr/${encodeURIComponent(r.id)}`} className="text-brand-red hover:underline">
                    {r.ntr_number}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{formatDateLocalized(r.delivery_date, locale)}</td>
                <td className="px-4 py-3">
                  {r.model ?? '-'}{' '}
                  {r.serial && (
                    <Link href={`/vehicles/${encodeURIComponent(r.serial)}`} className="text-gray-400 hover:text-brand-red hover:underline">
                      ({r.serial})
                    </Link>
                  )}
                </td>
                <td className="px-4 py-3">{r.customer_name}</td>
                <td className="px-4 py-3">{r.dealer_id}</td>
                <td className="px-4 py-3">{r.status}</td>
              </tr>
            ))}
            {result.data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {t('common.notFound')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {result.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-gray-500">
          <div>
            {filter.page > 1 ? (
              <Link href={pageHref(filter.page - 1)} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
                {t('common.back')}
              </Link>
            ) : null}
          </div>
          <div>
            {filter.page} / {totalPages}
          </div>
          <div>
            {filter.page < totalPages ? (
              <Link href={pageHref(filter.page + 1)} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
                →
              </Link>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
