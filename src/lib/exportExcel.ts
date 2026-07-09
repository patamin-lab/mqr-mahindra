import ExcelJS from 'exceljs';
import { MqrRecord } from './types';
import { formatThaiDateTime } from './thaiDate';

const LIST_COLUMNS: { header: string; key: string; width: number }[] = [
  { header: 'เลขที่งาน', key: 'job_id', width: 22 },
  { header: 'วันที่พบปัญหา', key: 'found_date', width: 14 },
  { header: 'รุ่นรถ', key: 'model', width: 16 },
  { header: 'หมายเลขรถ', key: 'serial', width: 18 },
  { header: 'ลูกค้า', key: 'customer_name', width: 20 },
  { header: 'เบอร์โทรลูกค้า', key: 'customer_phone', width: 14 },
  { header: 'อาการ', key: 'problem_code', width: 28 },
  { header: 'ระบบ', key: 'problem_system', width: 12 },
  { header: 'ชั่วโมงการใช้งาน', key: 'hours', width: 12 },
  { header: 'สถานะการรับประกัน', key: 'warranty_status', width: 18 },
  { header: 'สถานะงาน', key: 'status', width: 16 },
  { header: 'ผู้แจ้ง', key: 'reporter_name', width: 18 },
  { header: 'สาเหตุ', key: 'cause', width: 24 },
  { header: 'อะไหล่ที่เสียหาย', key: 'damaged_parts', width: 24 },
  { header: 'ผู้บันทึก', key: 'user_name', width: 16 },
  { header: 'วันที่บันทึก', key: 'created_at', width: 18 },
];

function problemSystemLabel(s: string | null) {
  if (s === 'powertrain') return 'Powertrain (48 เดือน)';
  if (s) return 'อื่นๆ (24 เดือน)';
  return '';
}

export async function buildRecordsWorkbook(records: MqrRecord[]): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MSEAL DMS';
  wb.created = new Date();
  const sheet = wb.addWorksheet('รายงาน MQR');
  sheet.columns = LIST_COLUMNS;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const r of records) {
    sheet.addRow({
      job_id: r.job_id,
      found_date: r.found_date ?? '',
      model: r.model ?? '',
      serial: r.serial ?? '',
      customer_name: r.customer_name ?? '',
      customer_phone: r.customer_phone ?? '',
      problem_code: r.problem_code ?? '',
      problem_system: problemSystemLabel(r.problem_system),
      hours: r.hours ?? '',
      warranty_status: r.warranty_status ?? '',
      status: r.status,
      reporter_name: r.reporter_name ?? '',
      cause: r.cause ?? '',
      damaged_parts: r.damaged_parts ?? '',
      user_name: r.user_name ?? '',
      created_at: r.created_at ? formatThaiDateTime(r.created_at) : '',
    });
  }

  const lastCol = String.fromCharCode(64 + LIST_COLUMNS.length);
  sheet.autoFilter = { from: 'A1', to: `${lastCol}1` };

  return wb.xlsx.writeBuffer();
}

export async function buildSingleRecordWorkbook(
  record: MqrRecord,
  dealerName?: string
): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MSEAL DMS';
  wb.created = new Date();
  const sheet = wb.addWorksheet(record.job_id.slice(0, 31));
  sheet.columns = [{ width: 24 }, { width: 60 }];

  const rows: [string, string][] = [
    ['เลขที่งาน', record.job_id],
    ['ดีลเลอร์', dealerName ?? record.dealer_id],
    ['หมายเลขรถ', record.serial ?? ''],
    ['รุ่นรถ', record.model ?? ''],
    ['ชั่วโมงการใช้งาน', record.hours !== null ? String(record.hours) : ''],
    ['วันที่พบปัญหา', record.found_date ?? ''],
    ['อาการที่พบ', record.problem_code ?? ''],
    ['ระบบ', problemSystemLabel(record.problem_system)],
    ['สถานะการรับประกัน', record.warranty_status ?? ''],
    ['สถานะงาน', record.status],
    ['ชื่อลูกค้า', record.customer_name ?? ''],
    ['เบอร์โทรลูกค้า', record.customer_phone ?? ''],
    ['ชื่อผู้แจ้ง', record.reporter_name ?? ''],
    ['เบอร์โทรผู้แจ้ง', record.reporter_phone ?? ''],
    ['รายละเอียดปัญหา', record.attachment ?? ''],
    ['สาเหตุ', record.cause ?? ''],
    ['อะไหล่ที่เสียหาย', record.damaged_parts ?? ''],
    ['ที่มาของรถ (ถ้าไม่พบในระบบ)', record.stock_note ?? ''],
    ['พิกัด', record.lat !== null && record.lng !== null ? `${record.lat}, ${record.lng}` : ''],
    ['ผู้บันทึก', record.user_name ?? record.created_by ?? ''],
    ['วันที่บันทึก', record.created_at ? formatThaiDateTime(record.created_at) : ''],
    ['ปรับปรุงล่าสุด', record.updated_at ? formatThaiDateTime(record.updated_at) : ''],
  ];

  rows.forEach(([label, value]) => {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(1).alignment = { vertical: 'top' };
    row.getCell(2).alignment = { vertical: 'top', wrapText: true };
  });

  if (record.photo_links && record.photo_links.length > 0) {
    sheet.addRow([]);
    const header = sheet.addRow(['รูปภาพ', '']);
    header.getCell(1).font = { bold: true };
    for (const p of record.photo_links) {
      sheet.addRow([p.label, p.url]);
    }
  }
  if (record.video_link) {
    sheet.addRow(['วิดีโอ', record.video_link]);
  }

  return wb.xlsx.writeBuffer();
}
