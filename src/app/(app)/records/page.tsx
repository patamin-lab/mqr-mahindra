import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { listRecords, listDealers } from '@/lib/db';
import { seesAllDealers, canExport } from '@/lib/scope';
import { STATUS_VALUES, STATUS_LABELS, StatusValue } from '@/lib/types';

const statusColor: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Open: 'bg-amber-100 text-amber-700',
  UnderInvestigation: 'bg-blue-100 text-blue-700',
  WaitingParts: 'bg-purple-100 text-purple-700',
  Repaired: 'bg-teal-100 text-teal-700',
  Closed: 'bg-green-100 text-green-700',
};

export default async function RecordsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; dealerId?: string };
}) {
  const session = await getSession();
  if (!session) return null;

  const records = await listRecords(session, {
    status: searchParams.status,
    q: searchParams.q,
    dealerId: searchParams.dealerId,
  });

  const dealers = seesAllDealers(session.role) ? await listDealers() : [];
  const allowExport = canExport(session.role);

  const exportQuery = new URLSearchParams();
  if (searchParams.status) exportQuery.set('status', searchParams.status);
  if (searchParams.q) exportQuery.set('q', searchParams.q);
  if (searchParams.dealerId) exportQuery.set('dealerId', searchParams.dealerId);
  const exportQs = exportQuery.toString();
  const exportHref = (format: 'xlsx' | 'pdf') =>
    `/api/records/export?format=${format}${exportQs ? `&${exportQs}` : ''}`;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-bold text-brand-dark">ติดตามรายงานปัญหาคุณภาพ</h1>
        <div className="flex flex-wrap items-center gap-2">
          {allowExport && (
            <>
              <a href={exportHref('xlsx')} className="btn-secondary">
                Export Excel
              </a>
              <a href={exportHref('pdf')} className="btn-secondary">
                Export PDF
              </a>
            </>
          )}
          <Link href="/report" className="btn-primary">
            + รายงานปัญหาใหม่
          </Link>
        </div>
      </div>

      <form className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium mb-1">ค้นหา</label>
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder="เลขที่รายงาน / Serial / ลูกค้า"
            className="border border-gray-300 rounded px-3 py-2 text-sm w-56"
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
        {dealers.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1">ดีลเลอร์</label>
            <select
              name="dealerId"
              defaultValue={searchParams.dealerId ?? ''}
              className="border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">ทั้งหมด</option>
              {dealers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.short_name}
                </option>
              ))}
            </select>
          </div>
        )}
        <button className="px-4 py-2 rounded border border-gray-300 text-sm bg-gray-50 hover:bg-gray-100 transition">กรอง</button>
        {(searchParams.q || searchParams.status || searchParams.dealerId) && (
          <Link href="/records" className="text-sm text-gray-500 underline">
            ล้างตัวกรอง
          </Link>
        )}
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
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
                  {r.model ?? '-'} <span className="text-gray-400">({r.serial ?? '-'})</span>
                </td>
                <td className="px-4 py-3">{r.customer_name ?? '-'}</td>
                <td className="px-4 py-3">{r.problem_code ?? '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{r.warranty_status ?? '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {STATUS_LABELS[r.status as StatusValue] ?? r.status}
                  </span>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  ไม่พบข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
