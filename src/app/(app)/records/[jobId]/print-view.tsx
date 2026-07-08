import { MqrRecord, SEVERITY_LABELS, Severity, STATUS_LABELS, StatusValue, PHOTO_CATEGORIES } from '@/lib/types';
import { formatThaiDateTime } from '@/lib/thaiDate';

/**
 * Print-only rendering of a record, built to mirror the PDF export
 * (src/lib/exportPdf.tsx) layout exactly, so "พิมพ์รายงาน" (window.print)
 * and "Export PDF" produce visually matching documents. Hidden on screen,
 * shown only inside @media print via `hidden print:block` (the rest of the
 * page, including the app sidebar, is `print:hidden`).
 */

const SEVERITY_COLORS: Record<Severity, string> = {
  Critical: '#c0392b',
  Major: '#d68910',
  Minor: '#2471a3',
};

function problemSystemLabel(s: string | null) {
  if (s === 'powertrain') return 'Powertrain (48 เดือน)';
  if (s) return 'อื่นๆ (24 เดือน)';
  return '-';
}

function fmt(v?: string | number | null) {
  return v !== null && v !== undefined && v !== '' ? String(v) : '-';
}

function Row2({
  l1,
  v1,
  l2,
  v2,
}: {
  l1: string;
  v1?: string | number | null;
  l2: string;
  v2?: string | number | null;
}) {
  return (
    <tr className="border-b border-gray-300">
      <td className="w-[17%] bg-gray-100 border-r border-gray-300 p-1.5 font-bold text-gray-600 align-top">{l1}</td>
      <td className="w-[33%] border-r border-gray-300 p-1.5 align-top">{fmt(v1)}</td>
      <td className="w-[17%] bg-gray-100 border-r border-gray-300 p-1.5 font-bold text-gray-600 align-top">{l2}</td>
      <td className="w-[33%] p-1.5 align-top">{fmt(v2)}</td>
    </tr>
  );
}

function RowFull({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | number | null;
  children?: React.ReactNode;
}) {
  return (
    <tr className="border-b border-gray-300">
      <td className="w-[17%] bg-gray-100 border-r border-gray-300 p-1.5 font-bold text-gray-600 align-top">{label}</td>
      <td className="p-1.5 align-top" colSpan={3}>
        {children ?? fmt(value)}
      </td>
    </tr>
  );
}

export default function RecordPrintView({
  record,
  dealerName,
  qrDataUrl,
  recordUrl,
}: {
  record: MqrRecord;
  dealerName?: string | null;
  qrDataUrl: string;
  recordUrl: string;
}) {
  const statusLabel = STATUS_LABELS[record.status as StatusValue] ?? record.status;
  const hasRca = !!(
    record.cause ||
    record.damaged_parts ||
    record.technician_action ||
    record.corrective_action ||
    record.preventive_action
  );

  return (
    <div className="hidden print:block text-[11px] text-gray-900">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-brand-redDark">ใบรายงานปัญหาคุณภาพ (Market Quality Report)</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            เลขที่งาน {record.job_id} — {dealerName ?? record.dealer_id}
          </p>
          <p className="text-gray-500 text-xs">พิมพ์เมื่อ {formatThaiDateTime(new Date())}</p>
          <div className="flex gap-1.5 mt-1.5">
            <span className="text-white text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: '#555' }}>
              {statusLabel}
            </span>
            {record.severity && (
              <span
                className="text-white text-[10px] px-2 py-0.5 rounded"
                style={{ backgroundColor: SEVERITY_COLORS[record.severity as Severity] }}
              >
                {SEVERITY_LABELS[record.severity as Severity]}
              </span>
            )}
          </div>
        </div>
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR" className="w-14 h-14" />
          <p className="text-[8px] text-gray-400 mt-0.5">สแกนเพื่อเปิดรายงาน</p>
        </div>
      </div>
      <div className="border-b-2 border-brand-redDark mt-1.5 mb-2.5" />

      <table className="w-full border border-gray-300 border-collapse">
        <tbody>
          <Row2
            l1="ลูกค้า"
            v1={[record.customer_name, record.customer_phone].filter(Boolean).join(' / ')}
            l2="ผู้แจ้งงาน"
            v2={[record.reporter_name, record.reporter_phone].filter(Boolean).join(' / ')}
          />
          <Row2 l1="รุ่นรถ" v1={record.model} l2="เลขรถ (Serial)" v2={record.serial} />
          <Row2 l1="วันที่พบปัญหา" v1={record.found_date} l2="วันที่นำรถเข้าซ่อม" v2={record.repair_date} />
          <Row2
            l1="ชั่วโมงที่พบปัญหา"
            v1={record.hours}
            l2="ชั่วโมงที่นำรถเข้าซ่อม"
            v2={record.hours_in_for_repair}
          />
          <Row2 l1="สาขาที่ดำเนินการ" v1={record.branch_name} l2="ช่างผู้ดำเนินการ" v2={record.technician_name} />
          <Row2
            l1="ระบบ"
            v1={problemSystemLabel(record.problem_system)}
            l2="สถานะการรับประกัน"
            v2={record.warranty_status}
          />
          <RowFull label="อาการที่พบ" value={record.problem_code} />
          {record.peripheral_equipment && <RowFull label="อุปกรณ์ต่อพ่วงที่ใช้งาน" value={record.peripheral_equipment} />}
          {record.stock_note && <RowFull label="ที่มาของรถ" value={record.stock_note} />}
          {record.lat !== null && record.lng !== null && (
            <RowFull label="พิกัดภูมิศาสตร์ (GPS)">
              <a
                className="text-blue-700"
                href={`https://www.openstreetmap.org/?mlat=${record.lat}&mlon=${record.lng}#map=16/${record.lat}/${record.lng}`}
              >
                {record.lat}, {record.lng} (เปิดแผนที่ OpenStreetMap)
              </a>
            </RowFull>
          )}
          {record.video_link && (
            <RowFull label="วิดีโอปัญหา">
              <a className="text-blue-700" href={record.video_link}>
                เปิดวิดีโอ
              </a>
            </RowFull>
          )}
        </tbody>
      </table>

      <div className="mt-2.5 mb-3">
        <h2 className="font-bold text-brand-redDark text-[12px] mb-1">รายละเอียดปัญหาที่ลูกค้าพบ</h2>
        <p className="whitespace-pre-wrap leading-snug">{record.attachment || '-'}</p>
      </div>

      {hasRca && (
        <table className="w-full border border-gray-300 border-collapse mb-3">
          <tbody>
            <tr>
              <td colSpan={4} className="bg-red-50 border-b border-red-200 p-1.5 font-bold text-brand-redDark text-[12px]">
                สาเหตุและการแก้ไข (RCA)
              </td>
            </tr>
            {record.cause && <RowFull label="สาเหตุ" value={record.cause} />}
            {record.damaged_parts && <RowFull label="ชิ้นส่วนที่เสียหาย" value={record.damaged_parts} />}
            {record.technician_action && <RowFull label="การดำเนินการของช่าง" value={record.technician_action} />}
            {record.corrective_action && <RowFull label="การแก้ไข (Corrective)" value={record.corrective_action} />}
            {record.preventive_action && <RowFull label="การป้องกัน (Preventive)" value={record.preventive_action} />}
          </tbody>
        </table>
      )}

      {PHOTO_CATEGORIES.map((cat) => {
        const photos = (record.photo_links ?? []).filter((p) => p.category === cat.key);
        return (
          <div key={cat.key} className="mb-2.5 break-inside-avoid">
            <div className="bg-brand-redDark text-white text-[11px] font-bold px-2 py-1 mb-1.5">{cat.label}</div>
            <div className="flex flex-wrap gap-2">
              {photos.length > 0 ? (
                photos.map((p, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <div key={i} className="w-[110px] border border-gray-300 p-1 break-inside-avoid">
                    <img src={p.url} alt={p.label} className="w-full h-[85px] object-cover" />
                    <p className="text-[8px] text-gray-500 text-center mt-0.5 truncate">{p.label}</p>
                  </div>
                ))
              ) : (
                <div className="w-[110px] h-[85px] border border-gray-300 bg-gray-50 flex items-center justify-center">
                  <span className="text-[8px] text-gray-400">ไม่มีรูป</span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div className="mt-3 text-[9px] text-gray-400">
        <p>
          สร้างโดย {record.created_by ?? record.user_name ?? '-'} · {formatThaiDateTime(record.created_at)}
          {record.updated_by
            ? ` — แก้ไขล่าสุดโดย ${record.updated_by} · ${formatThaiDateTime(record.updated_at)}`
            : ''}
        </p>
        <p className="mt-0.5">เอกสารออกเมื่อ {formatThaiDateTime(new Date())} โดยระบบ MQR</p>
        <p className="mt-0.5">{recordUrl}</p>
      </div>
    </div>
  );
}
