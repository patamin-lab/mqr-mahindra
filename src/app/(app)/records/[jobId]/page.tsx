import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getRecordByJobId, getVehicleHistory, getDealer } from '@/lib/db';
import { canUpdateStatus, canExport, canDelete } from '@/lib/scope';
import { STATUS_LABELS, StatusValue } from '@/lib/types';
import UpdateForm from './update-form';
import DeleteButton from './delete-button';

export default async function RecordDetailPage({ params }: { params: { jobId: string } }) {
  const session = await getSession();
  if (!session) return null;

  const jobId = decodeURIComponent(params.jobId);
  const record = await getRecordByJobId(jobId, session);
  if (!record) notFound();

  const dealer = await getDealer(record.dealer_id);
  const history = record.serial ? await getVehicleHistory(record.serial, session) : [];
  const otherHistory = history.filter((h) => h.job_id !== record.job_id);
  const encodedJobId = encodeURIComponent(record.job_id);
  const allowExport = canExport(session.role);
  const allowDelete = canDelete(session.role);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <Link href="/records" className="text-sm text-gray-500 hover:underline">
            ← กลับไปหน้ารายการ
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl font-bold text-brand-dark">{record.job_id}</h1>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {STATUS_LABELS[record.status as StatusValue] ?? record.status}
            </span>
          </div>
          <p className="text-sm text-gray-500">{dealer?.full_name ?? record.dealer_id}</p>
        </div>
        <div className="flex items-center gap-2">
          {allowExport && (
            <>
              <a
                href={`/api/records/${encodedJobId}/export?format=xlsx`}
                className="text-sm px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Export Excel
              </a>
              <a
                href={`/api/records/${encodedJobId}/export?format=pdf`}
                className="text-sm px-3 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Export PDF
              </a>
            </>
          )}
          {allowDelete && <DeleteButton jobId={record.job_id} />}
        </div>
      </div>

      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <div>
          <div className="text-gray-400 text-xs">รถ / Serial</div>
          <div>{record.model ?? '-'} ({record.serial ?? '-'})</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">ชั่วโมงการใช้งาน</div>
          <div>{record.hours ?? '-'}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">วันที่พบปัญหา</div>
          <div>{record.found_date ?? '-'}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">สถานะการรับประกัน</div>
          <div>{record.warranty_status ?? '-'}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">อาการที่พบ</div>
          <div>{record.problem_code ?? '-'}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">ระบบ</div>
          <div>{record.problem_system === 'powertrain' ? 'Powertrain (48 เดือน)' : 'อื่นๆ (24 เดือน)'}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">ลูกค้า</div>
          <div>{record.customer_name ?? '-'} {record.customer_phone ? `(${record.customer_phone})` : ''}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">ผู้แจ้ง</div>
          <div>{record.reporter_name ?? '-'} {record.reporter_phone ? `(${record.reporter_phone})` : ''}</div>
        </div>
        <div className="sm:col-span-2">
          <div className="text-gray-400 text-xs">รายละเอียดปัญหาที่ลูกค้าพบ</div>
          <div className="whitespace-pre-wrap">{record.attachment ?? '-'}</div>
        </div>
        {record.stock_note && (
          <div className="sm:col-span-2">
            <div className="text-gray-400 text-xs">ที่มาของรถ</div>
            <div>{record.stock_note}</div>
          </div>
        )}
        {record.lat !== null && record.lng !== null && (
          <div className="sm:col-span-2">
            <div className="text-gray-400 text-xs">พิกัด</div>
            <a
              className="text-brand-red hover:underline"
              target="_blank"
              href={`https://maps.google.com/?q=${record.lat},${record.lng}`}
            >
              {record.lat}, {record.lng}
            </a>
          </div>
        )}
      </section>

      {(record.photo_links?.length || record.video_link || record.after_photo_link) && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-brand-dark mb-3">รูปภาพ / วิดีโอ</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(record.photo_links ?? []).map((p, i) => (
              <a key={i} href={p.url} target="_blank" className="block">
                <img src={p.url} alt={p.label} className="rounded border border-gray-200 aspect-square object-cover" />
                <div className="text-xs text-gray-500 mt-1 truncate">{p.label}</div>
              </a>
            ))}
            {record.after_photo_link && (
              <a href={record.after_photo_link} target="_blank" className="block">
                <img src={record.after_photo_link} alt="หลังซ่อม" className="rounded border border-gray-200 aspect-square object-cover" />
                <div className="text-xs text-gray-500 mt-1">รูปหลังซ่อม</div>
              </a>
            )}
          </div>
          {record.video_link && (
            <a href={record.video_link} target="_blank" className="inline-block mt-3 text-sm text-brand-red hover:underline">
              ▶ ดูวิดีโอปัญหา
            </a>
          )}
        </section>
      )}

      {otherHistory.length > 0 && (
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-brand-dark mb-3">ประวัติการซ่อมของรถคันนี้ ({otherHistory.length})</h2>
          <ul className="text-sm divide-y divide-gray-100">
            {otherHistory.map((h) => (
              <li key={h.id} className="py-2 flex justify-between gap-3">
                <Link href={`/records/${encodeURIComponent(h.job_id)}`} className="text-brand-red hover:underline font-mono">
                  {h.job_id}
                </Link>
                <span className="text-gray-500">{h.found_date}</span>
                <span className="text-gray-700 flex-1">{h.problem_code}</span>
                <span className="text-gray-500">{STATUS_LABELS[h.status as StatusValue] ?? h.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-brand-dark mb-3">อัปเดตสถานะ</h2>
        {canUpdateStatus(session.role) ? (
          <UpdateForm record={record} />
        ) : (
          <p className="text-sm text-gray-500">คุณไม่มีสิทธิ์อัปเดตสถานะรายงานนี้</p>
        )}
      </section>

      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 text-xs text-gray-500 space-y-1">
        <h2 className="font-semibold text-brand-dark text-sm mb-2">ข้อมูลการบันทึก (Audit Trail)</h2>
        <div>สร้างโดย: {record.created_by ?? record.user_name ?? '-'} · {new Date(record.created_at).toLocaleString('th-TH')}</div>
        {record.updated_by && (
          <div>แก้ไขล่าสุดโดย: {record.updated_by} · {new Date(record.updated_at).toLocaleString('th-TH')}</div>
        )}
      </section>
    </div>
  );
}
