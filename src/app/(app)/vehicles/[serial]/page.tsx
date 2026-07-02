import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getVehicleSummary, getVehicleTimeline } from '@/features/vehicle/service';
import { VEHICLE_EVENT_MODULE_LABEL, VehicleEvent } from '@/features/vehicle/types';
import type { MaintenanceDueColor } from '@/features/maintenance-due/types';
import type { HealthStatus } from '@/features/vehicle-health/types';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { serial: string };
}

const DUE_COLOR_CLASS: Record<MaintenanceDueColor, string> = {
  green: 'bg-green-100 text-green-700',
  yellow: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  gray: 'bg-gray-100 text-gray-500',
};

const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  excellent: 'ดีเยี่ยม',
  good: 'ดี',
  attention: 'ควรดูแล',
  critical: 'วิกฤต',
};

const HEALTH_STATUS_CLASS: Record<HealthStatus, string> = {
  excellent: 'bg-green-100 text-green-700',
  good: 'bg-blue-100 text-blue-700',
  attention: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

export default async function Vehicle360Page({ params }: RouteParams) {
  const serial = decodeURIComponent(params.serial);
  const session = await getSession();
  if (!session) return null;

  const [summary, timeline] = await Promise.all([
    getVehicleSummary(serial, session),
    getVehicleTimeline(serial, session),
  ]);

  if (!summary) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-brand-dark">Vehicle 360</h1>
            <p className="text-sm text-gray-500">Serial: {serial}</p>
          </div>
          <Link href="/vehicles" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            ค้นหาใหม่
          </Link>
        </div>
        <div className="rounded border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          <p>ไม่พบข้อมูลรถหมายเลขนี้ หรือคุณไม่มีสิทธิ์เข้าถึง</p>
        </div>
      </div>
    );
  }

  const programLabel =
    summary.maintenanceProgramStages.length > 0
      ? summary.maintenanceProgramStages
          .map((s) => s.label)
          .join(' / ')
      : 'ยังไม่มีการกำหนดรอบบำรุงรักษา';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">Vehicle 360</h1>
          <p className="text-sm text-gray-500">
            {summary.serial} {summary.model ? `· ${summary.model}` : ''}
          </p>
        </div>
        <Link href="/vehicles" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          ค้นหาใหม่
        </Link>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">ข้อมูลรถ / เจ้าของรถ</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailRow label="Serial Number" value={summary.serial} />
          <DetailRow label="รุ่นรถ" value={summary.model ?? 'N/A'} />
          <DetailRow label="กลุ่มผลิตภัณฑ์ (Product Family)" value={summary.productFamilyName ?? 'ยังไม่ได้ผูกกลุ่มผลิตภัณฑ์'} />
          <DetailRow label="หมายเลขเครื่องยนต์" value={summary.engineNumber ?? 'N/A'} />
          <DetailRow label="วันที่ส่งมอบ (Retail Date)" value={summary.retailDate ?? 'N/A'} />
          <DetailRow label="ดีลเลอร์" value={summary.dealerName ?? summary.dealerId ?? 'N/A'} />
          <DetailRow label="สาขา" value={summary.branchName ?? 'N/A'} />
          <DetailRow label="ชื่อลูกค้า (เจ้าของรถ)" value={summary.ownerName ?? 'N/A'} />
          <DetailRow label="เบอร์โทรลูกค้า" value={summary.ownerPhone ?? 'N/A'} />
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">การบำรุงรักษา (Maintenance)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailRow label="Maintenance Program" value={programLabel} />
          <DetailRow label="ชั่วโมงเครื่องยนต์ล่าสุด" value={summary.currentHourMeter != null ? `${summary.currentHourMeter} ชม.` : 'N/A'} />
          <DetailRow label="บำรุงรักษาครั้งล่าสุด" value={summary.lastMaintenanceDate ?? 'ยังไม่มีประวัติ'} />
          <DetailRow label="รอบถัดไป" value={summary.nextMaintenanceLabel ?? 'N/A'} />
          <DetailRow
            label="ชั่วโมงคงเหลือ"
            value={summary.remainingHours != null ? `${summary.remainingHours} ชม.` : 'N/A'}
          />
          <DetailRow label="วันคงเหลือ" value={summary.remainingDays != null ? `${summary.remainingDays} วัน` : 'N/A'} />
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">สถานะการบำรุงรักษา</p>
            <p className="mt-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DUE_COLOR_CLASS[summary.maintenanceDueColor]}`}>
                {summary.maintenanceDueLabel}
              </span>
            </p>
          </div>
          <DetailRow
            label="Maintenance Compliance"
            value={
              summary.compliancePercent != null
                ? `${summary.completedStageCount} / ${summary.expectedStageCount} (${summary.compliancePercent}%)`
                : 'N/A'
            }
          />
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">Vehicle Health</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Health Score</p>
            <p className="mt-1 text-2xl font-bold text-brand-dark">{summary.healthScore}</p>
          </div>
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Health Status</p>
            <p className="mt-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HEALTH_STATUS_CLASS[summary.healthStatus]}`}>
                {HEALTH_STATUS_LABEL[summary.healthStatus]}
              </span>
            </p>
          </div>
          <DetailRow label="MQR ที่ยังไม่ปิด (Open MQR)" value={String(summary.openMqrCount)} />
          <DetailRow label="แคมเปญค้างดำเนินการ" value={String(summary.pendingCampaignCount)} />
        </div>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">Vehicle Life Cycle</h2>
        {timeline.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">ยังไม่มีเหตุการณ์ในประวัติรถคันนี้</p>
        ) : (
          <ol className="space-y-3">
            {timeline.map((event, idx) => (
              <TimelineRow key={`${event.type}-${event.referenceNumber}-${idx}`} event={event} />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function TimelineRow({ event }: { event: VehicleEvent }) {
  return (
    <li className="rounded border border-gray-100 p-3 hover:bg-gray-50">
      <Link href={event.href} className="block">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-400">{event.date}</span>
            <span className="rounded-full bg-brand-dark/5 px-2 py-0.5 text-xs font-medium text-brand-dark">
              {VEHICLE_EVENT_MODULE_LABEL[event.type]}
            </span>
            <span className="text-xs text-brand-red">{event.referenceNumber}</span>
          </div>
          {event.status && <span className="text-xs text-gray-500">{event.status}</span>}
        </div>
        <p className="mt-1 text-sm text-gray-800">{event.description}</p>
        {event.user && <p className="mt-0.5 text-xs text-gray-400">โดย {event.user}</p>}
      </Link>
    </li>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50 p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-sm text-gray-900">{value}</p>
    </div>
  );
}
