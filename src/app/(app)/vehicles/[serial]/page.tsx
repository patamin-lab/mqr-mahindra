import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { getVehicle360Header, getVehicleTimeline } from '@/features/vehicle-360/service';
import { VEHICLE_EVENT_MODULE_LABEL, VehicleEvent, MaintenanceStatus } from '@/features/vehicle-360/types';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: { serial: string };
}

const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  normal: 'ปกติ',
  due_soon: 'ใกล้ถึงกำหนด',
  overdue: 'เลยกำหนด',
  none: 'ยังไม่มีประวัติ PM',
};

const MAINTENANCE_STATUS_CLASS: Record<MaintenanceStatus, string> = {
  normal: 'bg-green-100 text-green-700',
  due_soon: 'bg-amber-100 text-amber-700',
  overdue: 'bg-red-100 text-red-700',
  none: 'bg-gray-100 text-gray-500',
};

export default async function Vehicle360Page({ params }: RouteParams) {
  const serial = decodeURIComponent(params.serial);
  const session = await getSession();
  if (!session) return null;

  const [header, timeline] = await Promise.all([
    getVehicle360Header(serial, session),
    getVehicleTimeline(serial, session),
  ]);

  if (!header) {
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-brand-dark">Vehicle 360</h1>
          <p className="text-sm text-gray-500">
            {header.serial} {header.model ? `· ${header.model}` : ''}
          </p>
        </div>
        <Link href="/vehicles" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
          ค้นหาใหม่
        </Link>
      </div>

      <div className="rounded border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DetailRow label="Serial Number" value={header.serial} />
          <DetailRow label="รุ่นรถ" value={header.model ?? 'N/A'} />
          <DetailRow label="หมายเลขเครื่องยนต์" value={header.engineNumber ?? 'N/A'} />
          <DetailRow label="วันที่ส่งมอบ (Retail Date)" value={header.retailDate ?? 'N/A'} />
          <DetailRow label="ดีลเลอร์" value={header.dealerName ?? header.dealerId ?? 'N/A'} />
          <DetailRow label="สาขา" value={header.branchName ?? 'N/A'} />
          <DetailRow label="ชื่อลูกค้า (เจ้าของรถ)" value={header.ownerName ?? 'N/A'} />
          <DetailRow label="เบอร์โทรลูกค้า" value={header.ownerPhone ?? 'N/A'} />
          <DetailRow label="ชั่วโมงเครื่องยนต์ล่าสุด" value={header.currentHourMeter != null ? `${header.currentHourMeter} ชม.` : 'N/A'} />
          <DetailRow label="กำหนด PM ครั้งถัดไป" value={header.nextMaintenanceDate ?? 'N/A'} />
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">สถานะการบำรุงรักษา</p>
            <p className="mt-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MAINTENANCE_STATUS_CLASS[header.maintenanceStatus]}`}>
                {MAINTENANCE_STATUS_LABEL[header.maintenanceStatus]}
              </span>
            </p>
          </div>
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">สถานะรถ</p>
            <p className="mt-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  header.vehicleStatus === 'open_job' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                }`}
              >
                {header.vehicleStatus === 'open_job' ? 'มีงานค้าง (MQR)' : 'ปกติ'}
              </span>
            </p>
          </div>
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
