/**
 * Maintenance (PM Record) — CSV export.
 *
 * Reuses the shared buildCsv() helper (UTF-8 BOM + CSV escaping) from
 * lib/exportCsv.ts rather than re-implementing it - only the column
 * mapping here is PM-specific, matching lib/exportCsv.ts's own
 * MQR_CSV_COLUMNS pattern.
 */
import { buildCsv, CsvColumn } from '@/lib/exportCsv';
import { formatThaiDateTime } from '@/lib/thaiDate';
import { MaintenanceRecord } from '../types';

const PM_CSV_COLUMNS: CsvColumn<MaintenanceRecord>[] = [
  { header: 'เลขที่ PM', value: (r) => r.pm_number },
  { header: 'ดีลเลอร์', value: (r) => r.dealer_id },
  { header: 'สาขา', value: (r) => r.branch_name },
  { header: 'วันที่ทำ PM', value: (r) => r.performed_date },
  { header: 'รุ่นรถ', value: (r) => r.model },
  { header: 'หมายเลขรถ', value: (r) => r.serial },
  { header: 'หมายเลขเครื่อง', value: (r) => r.engine_number },
  { header: 'ชื่อลูกค้า', value: (r) => r.customer_name },
  { header: 'เบอร์โทรลูกค้า', value: (r) => r.customer_phone },
  { header: 'ช่างซ่อม', value: (r) => r.technician_name },
  { header: 'ชั่วโมงเครื่องยนต์', value: (r) => r.hour_meter },
  { header: 'รอบ PM ถัดไป', value: (r) => r.next_pm_due },
  { header: 'สถานะ', value: (r) => r.status },
  { header: 'หมายเหตุ', value: (r) => r.notes },
  { header: 'ผู้บันทึก', value: (r) => r.created_by },
  { header: 'วันที่บันทึก', value: (r) => (r.created_at ? formatThaiDateTime(r.created_at) : '') },
];

export function buildMaintenanceRecordsCsv(records: MaintenanceRecord[]): Buffer {
  return buildCsv(records, PM_CSV_COLUMNS);
}
