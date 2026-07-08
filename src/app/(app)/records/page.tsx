import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { listRecordsPaginated, listDealers, getDealer, getBranchById } from '@/lib/db';
import { seesAllDealers, canExport } from '@/lib/scope';
import { STATUS_VALUES, STATUS_LABELS, StatusValue } from '@/lib/types';
import PageHeader from '@/components/shared/layout/PageHeader';
import StatusPill from '@/components/shared/status/StatusPill';
import SearchToolbar from '@/components/shared/layout/SearchToolbar';
import EmptyState from '@/components/shared/admin/EmptyState';
import RecordsFilterBar from './RecordsFilterBar';

/** Colors per docs/standards/DOMAIN_LANGUAGE_STANDARD.md's Status Colors
 *  table - Draft has no entry there (predates the standard's status list),
 *  kept neutral gray. */
const statusColor: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Open: 'bg-blue-100 text-blue-700',
  UnderInvestigation: 'bg-orange-100 text-orange-700',
  WaitingParts: 'bg-amber-100 text-amber-700',
  WaitingCustomer: 'bg-purple-100 text-purple-700',
  Repaired: 'bg-green-100 text-green-700',
  Closed: 'bg-gray-200 text-gray-700',
  Rejected: 'bg-red-100 text-red-700',
};

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: {
    status?: string;
    q?: string;
    dealerId?: string;
    branchId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: string;
  };
}) {
  const session = await getSession();
  if (!session) return null;

  const page = Math.max(parseInt(searchParams.page ?? '1', 10) || 1, 1);
  const pageSize = 50;
  const { records, total } = await listRecordsPaginated(session, {
    status: searchParams.status,
    q: searchParams.q,
    dealerId: searchParams.dealerId,
    branchId: searchParams.branchId,
    dateFrom: searchParams.dateFrom,
    dateTo: searchParams.dateTo,
    page,
    pageSize,
  });
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  // Dealer/Branch Scope Platform Standard: SuperAdmin/CentralAdmin get the
  // full dealer list; branches are resolved client-side by
  // `RecordsFilterBar`'s `useDealerBranchScope`, only for whichever dealer
  // is actually known.
  const dealers = seesAllDealers(session.role) ? await listDealers() : [];
  const pinnedDealer = !seesAllDealers(session.role) && session.dealerId ? await getDealer(session.dealerId) : null;
  const pinnedBranch = session.role === 'DealerUser' && session.branchId ? await getBranchById(session.branchId) : null;
  const allowExport = canExport(session.role);

  const exportQuery = new URLSearchParams();
  if (searchParams.status) exportQuery.set('status', searchParams.status);
  if (searchParams.q) exportQuery.set('q', searchParams.q);
  if (searchParams.dealerId) exportQuery.set('dealerId', searchParams.dealerId);
  if (searchParams.branchId) exportQuery.set('branchId', searchParams.branchId);
  if (searchParams.dateFrom) exportQuery.set('dateFrom', searchParams.dateFrom);
  if (searchParams.dateTo) exportQuery.set('dateTo', searchParams.dateTo);
  const exportQs = exportQuery.toString();
  const exportHref = (format: 'xlsx' | 'pdf' | 'csv') =>
    `/api/records/export?format=${format}${exportQs ? `&${exportQs}` : ''}`;

  const pageHref = (targetPage: number) => {
    const qs = new URLSearchParams();
    if (searchParams.status) qs.set('status', searchParams.status);
    if (searchParams.q) qs.set('q', searchParams.q);
    if (searchParams.dealerId) qs.set('dealerId', searchParams.dealerId);
    if (searchParams.branchId) qs.set('branchId', searchParams.branchId);
    if (searchParams.dateFrom) qs.set('dateFrom', searchParams.dateFrom);
    if (searchParams.dateTo) qs.set('dateTo', searchParams.dateTo);
    if (targetPage > 1) qs.set('page', String(targetPage));
    const s = qs.toString();
    return `/records${s ? `?${s}` : ''}`;
  };

  return (
    <div>
      <PageHeader
        title="ติดตามรายงานปัญหาคุณภาพ"
        titleClassName="text-2xl font-bold text-brand-dark"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4"
        actionsClassName="flex flex-wrap items-center gap-2"
        actions={
          <>
            {allowExport && (
              <>
                <a href={exportHref('xlsx')} className="btn-secondary">
                  Export Excel
                </a>
                <a href={exportHref('pdf')} className="btn-secondary">
                  Export PDF
                </a>
                <a href={exportHref('csv')} className="btn-secondary">
                  Export CSV
                </a>
              </>
            )}
            <Link href="/report" className="btn-primary">
              + รายงานปัญหาใหม่
            </Link>
          </>
        }
      />

      <SearchToolbar
        cardClassName="p-4 mb-4 flex flex-wrap gap-3 items-end"
        filterLabel="กรอง"
        filterButtonClassName="px-4 py-2 rounded border border-gray-300 text-sm bg-gray-50 hover:bg-gray-100 transition"
        clearHref={
          searchParams.q ||
          searchParams.status ||
          searchParams.dealerId ||
          searchParams.branchId ||
          searchParams.dateFrom ||
          searchParams.dateTo
            ? '/records'
            : undefined
        }
        clearLabel="ล้างตัวกรอง"
      >
        <div>
          <label className="block text-xs font-medium mb-1">ค้นหา</label>
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="เลขที่รายงาน / Serial / ลูกค้า / สาขา / ช่าง / อาการ"
            className="border border-gray-300 rounded px-3 py-2 text-sm w-64"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">สถานะ</label>
          <select
            name="status"
            defaultValue={searchParams.status ?? ''}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="">ทั้งหมด</option>
            {STATUS_VALUES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s as StatusValue]}
              </option>
            ))}
          </select>
        </div>
        <RecordsFilterBar
          role={session.role}
          sessionDealerId={session.dealerId}
          sessionBranchId={session.branchId}
          pinnedDealerName={pinnedDealer?.short_name}
          pinnedBranchName={pinnedBranch?.name}
          initialDealers={dealers}
          initialDealerId={searchParams.dealerId}
          initialBranchId={searchParams.branchId}
          dealerLabel="ดีลเลอร์"
          branchLabel="สาขา"
          dealerAllLabel="ทั้งหมด"
          branchAllLabel="ทั้งหมด"
        />
        <div>
          <label className="block text-xs font-medium mb-1">วันที่พบปัญหา (จาก)</label>
          <input
            type="date"
            name="dateFrom"
            defaultValue={searchParams.dateFrom ?? ''}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">วันที่พบปัญหา (ถึง)</label>
          <input
            type="date"
            name="dateTo"
            defaultValue={searchParams.dateTo ?? ''}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          />
        </div>
      </SearchToolbar>

      <div className="card overflow-x-auto max-h-[70vh] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">เลขที่รายงาน</th>
              <th className="text-left px-4 py-3">วันที่พบ</th>
              <th className="text-left px-4 py-3">รถ / Serial</th>
              <th className="text-left px-4 py-3">ลูกค้า</th>
              <th className="text-left px-4 py-3">อาการ</th>
              <th className="text-left px-4 py-3">ประกัน</th>
              <th className="text-left px-4 py-3">สถานะ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {records.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono">
                  <Link href={`/records/${encodeURIComponent(r.job_id)}`} className="text-brand-red hover:underline">
                    {r.job_id}
                  </Link>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{r.found_date ?? '-'}</td>
                <td className="px-4 py-3">
                  {r.model ?? '-'}{' '}
                  {r.serial ? (
                    <Link href={`/vehicles/${encodeURIComponent(r.serial)}`} className="text-gray-400 hover:text-brand-red hover:underline">
                      ({r.serial})
                    </Link>
                  ) : (
                    <span className="text-gray-400">(-)</span>
                  )}
                </td>
                <td className="px-4 py-3">{r.customer_name ?? '-'}</td>
                <td className="px-4 py-3">{r.problem_code ?? '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.warranty_status ?? '-'}</td>
                <td className="px-4 py-3">
                  <StatusPill colorClassName={statusColor[r.status] ?? 'bg-gray-100 text-gray-600'}>
                    {STATUS_LABELS[r.status as StatusValue] ?? r.status}
                  </StatusPill>
                </td>
              </tr>
            ))}
            {records.length === 0 && <EmptyState colSpan={7} />}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 text-sm text-gray-500">
          <div>
            แสดง {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} จากทั้งหมด {total} รายการ
          </div>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
                ก่อนหน้า
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded border border-gray-200 text-gray-300 cursor-not-allowed">ก่อนหน้า</span>
            )}
            <span>
              หน้า {page} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-50">
                ถัดไป
              </Link>
            ) : (
              <span className="px-3 py-1.5 rounded border border-gray-200 text-gray-300 cursor-not-allowed">ถัดไป</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
