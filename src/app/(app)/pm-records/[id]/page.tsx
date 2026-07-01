import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { SupabasePmRecordRepository } from '@/features/pm-record/supabaseRepository';
import { PmRecordService } from '@/features/pm-record/service';
import { PmRecord } from '@/features/pm-record/types';
import StatusBadge from '@/components/shared/status/StatusBadge';

/**
 * PM Record detail page — Sprint 11.3.
 *
 * Server component: calls the service directly (no HTTP round-trip).
 * Auth is also enforced by the (app) layout; the local redirect is
 * defensive-in-depth for any future layout change.
 *
 * Dealer isolation: enforced by PmRecordService.getById().
 * - NOT_FOUND  → Next.js notFound() → 404 page
 * - FORBIDDEN  → inline 403 message
 * - Other      → re-throw → Next.js error boundary
 */

// ---------------------------------------------------------------------------
// PM-specific status badge
// StatusBadge is a boolean active/inactive component. We map PM status strings
// to it for completed and cancelled; use an amber pill for 'scheduled' since
// there is no "pending" concept in StatusBadge.
// ---------------------------------------------------------------------------
function PmStatusBadge({ status }: { status: string }) {
  if (status === 'completed') {
    return <StatusBadge active={true} activeLabel="เสร็จสิ้น" />;
  }
  if (status === 'cancelled') {
    return <StatusBadge active={false} inactiveLabel="ยกเลิกแล้ว" />;
  }
  // 'scheduled' — default initial status
  return (
    <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">
      รอนัดหมาย
    </span>
  );
}

// ---------------------------------------------------------------------------
// Detail row: label | value layout used across all sections
// ---------------------------------------------------------------------------
function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2.5 border-b border-gray-50 last:border-0">
      <dt className="text-sm text-gray-500 font-medium">{label}</dt>
      <dd className="col-span-2 text-sm text-gray-800">
        {value ?? <span className="text-gray-300">—</span>}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Format ISO timestamps to Thai locale string (server-side, no hydration risk)
// ---------------------------------------------------------------------------
function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Forbidden page (403)
// ---------------------------------------------------------------------------
function ForbiddenPage() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/pm-records"
        className="text-xs text-gray-400 hover:text-gray-600 mb-3 inline-block"
      >
        ← กลับหน้ารายการ PM
      </Link>
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 space-y-3">
        <p className="font-semibold text-red-800">ไม่มีสิทธิ์เข้าถึง (403)</p>
        <p className="text-sm text-red-700">
          คุณไม่มีสิทธิ์เข้าถึง PM Record นี้ กรุณาติดต่อผู้ดูแลระบบ
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main detail page
// ---------------------------------------------------------------------------
export default async function PmRecordDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const repository = new SupabasePmRecordRepository();
  const service = new PmRecordService(repository);

  let record: PmRecord;

  try {
    record = await service.getById(params.id, {
      username: session.username,
      dealerId: session.dealerId,
    });
  } catch (e: unknown) {
    const error = e as { code?: string };
    if (error?.code === 'NOT_FOUND') notFound();
    if (error?.code === 'FORBIDDEN') return <ForbiddenPage />;
    throw e; // surface 500s to Next.js error boundary
  }

  return (
    <div className="space-y-4 max-w-3xl">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/pm-records"
            className="text-xs text-gray-400 hover:text-gray-600 mb-1 inline-block"
          >
            ← กลับหน้าบำรุงรักษาเชิงป้องกัน
          </Link>
          <h1 className="text-xl font-bold text-brand-dark">
            รายละเอียด PM Record
          </h1>
        </div>
        <div className="pt-6 shrink-0">
          <PmStatusBadge status={record.status} />
        </div>
      </div>

      {/* ── Vehicle Information ─────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-brand-dark mb-4">1. ข้อมูลรถ</h2>
        <dl>
          <DetailRow
            label="หมายเลขรถ (Serial)"
            value={
              record.serial ? (
                <span className="font-mono">{record.serial}</span>
              ) : null
            }
          />
          <DetailRow label="รุ่นรถ (Model)" value={record.model} />
          <DetailRow label="วันที่ส่งมอบ" value={record.delivery_date} />
        </dl>
      </section>

      {/* ── Customer Snapshot ───────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-brand-dark mb-1">2. ข้อมูลลูกค้า</h2>
        <p className="text-xs text-gray-400 mb-4">
          บันทึกเป็น Snapshot ณ วันที่บันทึก — ไม่เชื่อมต่อกับ Customer Master
        </p>
        <dl>
          <DetailRow label="ชื่อลูกค้า" value={record.customer_name} />
          <DetailRow label="เบอร์โทรลูกค้า" value={record.customer_phone} />
        </dl>
      </section>

      {/* ── PM Details ──────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-brand-dark mb-4">3. รายละเอียด PM</h2>
        <dl>
          <DetailRow label="ดีลเลอร์" value={record.dealer_id} />
          <DetailRow label="สาขา" value={record.branch_id} />
          <DetailRow label="วันที่นัดหมาย PM" value={record.scheduled_date} />
          <DetailRow label="วันที่ดำเนินการ" value={record.performed_date} />
          <DetailRow label="ช่างเทคนิค" value={record.technician_id} />
          <DetailRow
            label="สถานะ"
            value={<PmStatusBadge status={record.status} />}
          />
          <DetailRow label="หมายเหตุ" value={record.notes} />
        </dl>
      </section>

      {/* ── Audit ───────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-brand-dark mb-4">ข้อมูลระบบ</h2>
        <dl>
          <DetailRow
            label="รหัสอ้างอิง"
            value={
              <span className="font-mono text-xs break-all">{record.id}</span>
            }
          />
          <DetailRow label="สร้างโดย" value={record.created_by} />
          <DetailRow
            label="สร้างเมื่อ"
            value={formatDate(record.created_at)}
          />
          <DetailRow label="แก้ไขโดย" value={record.updated_by} />
          <DetailRow
            label="แก้ไขเมื่อ"
            value={formatDate(record.updated_at)}
          />
        </dl>
      </section>

    </div>
  );
}
