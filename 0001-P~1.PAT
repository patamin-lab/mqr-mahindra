From a14ee34657777aad1f5836b903415188f5df1ab6 Mon Sep 17 00:00:00 2001
From: patamin-lab <patamin@gmail.com>
Date: Wed, 24 Jun 2026 03:01:51 +0000
Subject: [PATCH] Phase 7: refine exports with Phase 3/4 fields, add monthly
 summary report export
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit

- Excel bulk export: add dealer_id, severity, branch_name, technician_name,
  repair_date, peripheral_equipment, technician/corrective/preventive action
  columns (previously stuck at the Phase 2 column set)
- Excel single-record export: backfill severity, branch, technician, repair
  date, RCA fields that were missing since Phase 3/4
- PDF bulk list export: add dealer and severity columns
- New buildMonthlySummaryWorkbook() — multi-sheet Excel report (KPI summary,
  monthly trend, top problems/Pareto, top parts, by-model, aging backlog,
  dealer/branch/technician leaderboards) built from dashboardStats()
- New /api/dashboard/export route + dashboard page download button, scoped
  by the same filters/permissions as the dashboard view (canExport gate)
- Verified (read-only) that record export scoping for Dealer Admin/User was
  already correct from earlier phases; no fix needed there
---
 src/app/(app)/dashboard/page.tsx      |  20 ++-
 src/app/api/dashboard/export/route.ts |  52 +++++++
 src/lib/exportExcel.ts                | 194 +++++++++++++++++++++++++-
 src/lib/exportPdf.tsx                 |  32 +++--
 4 files changed, 278 insertions(+), 20 deletions(-)
 create mode 100644 src/app/api/dashboard/export/route.ts

diff --git a/src/app/(app)/dashboard/page.tsx b/src/app/(app)/dashboard/page.tsx
index ab3c32c..b0a5fc5 100644
--- a/src/app/(app)/dashboard/page.tsx
+++ b/src/app/(app)/dashboard/page.tsx
@@ -1,7 +1,7 @@
 import Link from 'next/link';
 import { getSession } from '@/lib/auth';
 import { dashboardStats, listDealers } from '@/lib/db';
-import { seesAllDealers } from '@/lib/scope';
+import { seesAllDealers, canExport } from '@/lib/scope';
 import { STATUS_LABELS, StatusValue, SEVERITY_LABELS, Severity } from '@/lib/types';
 import { THAI_MONTHS_FULL, formatMonthKeyThai, buildYearOptions, toBuddhistYear } from '@/lib/thaiDate';
 import {
@@ -80,11 +80,23 @@ export default async function DashboardPage({
   }));
   const byModelData = stats.byModel.map((m) => ({ ...m, modelLabel: m.model }));
 
+  const exportHref = `/api/dashboard/export${filterQuery.toString() ? `?${filterQuery.toString()}` : ''}`;
+
   return (
     <div className="space-y-8">
-      <div>
-        <h1 className="text-2xl font-bold text-brand-dark">หน้าหลัก</h1>
-        <p className="text-sm text-gray-500">ภาพรวมคุณภาพและสถานะงานซ่อมในระยะรับประกัน</p>
+      <div className="flex flex-wrap items-start justify-between gap-3">
+        <div>
+          <h1 className="text-2xl font-bold text-brand-dark">หน้าหลัก</h1>
+          <p className="text-sm text-gray-500">ภาพรวมคุณภาพและสถานะงานซ่อมในระยะรับประกัน</p>
+        </div>
+        {canExport(session.role) && (
+          <a
+            href={exportHref}
+            className="px-4 py-2 rounded bg-brand-red text-white text-sm font-medium hover:bg-red-700"
+          >
+            ดาวน์โหลดสรุปประจำเดือน (Excel)
+          </a>
+        )}
       </div>
 
       {/* ---------- Filter bar ---------- */}
diff --git a/src/app/api/dashboard/export/route.ts b/src/app/api/dashboard/export/route.ts
new file mode 100644
index 0000000..584d1ed
--- /dev/null
+++ b/src/app/api/dashboard/export/route.ts
@@ -0,0 +1,52 @@
+import { NextRequest, NextResponse } from 'next/server';
+import { getSession } from '@/lib/auth';
+import { dashboardStats, getDealer } from '@/lib/db';
+import { canExport, seesAllDealers } from '@/lib/scope';
+import { buildMonthlySummaryWorkbook } from '@/lib/exportExcel';
+import { toBuddhistYear, THAI_MONTHS_FULL } from '@/lib/thaiDate';
+
+export const runtime = 'nodejs';
+
+export async function GET(req: NextRequest) {
+  const session = await getSession();
+  if (!session) {
+    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
+  }
+  if (!canExport(session.role)) {
+    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์ส่งออกข้อมูล' }, { status: 403 });
+  }
+
+  const { searchParams } = new URL(req.url);
+  const year = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;
+  const month = searchParams.get('month') ? Number(searchParams.get('month')) : undefined;
+  const model = searchParams.get('model') ?? undefined;
+  const dealerId = searchParams.get('dealerId') ?? undefined;
+
+  const stats = await dashboardStats(session, { year, month, model, dealerId });
+
+  const periodLabel = year
+    ? `พ.ศ. ${toBuddhistYear(year)}${month ? ` เดือน${THAI_MONTHS_FULL[month - 1]}` : ''}`
+    : 'ย้อนหลัง 12 เดือนล่าสุด';
+
+  let scopeLabel = model ? `รุ่น ${model}` : 'ทุกรุ่น';
+  if (seesAllDealers(session.role)) {
+    if (dealerId) {
+      const dealer = await getDealer(dealerId);
+      scopeLabel += ` · ดีลเลอร์ ${dealer?.short_name ?? dealerId}`;
+    } else {
+      scopeLabel += ' · ทุกดีลเลอร์';
+    }
+  } else {
+    scopeLabel += ' · ดีลเลอร์ของฉัน';
+  }
+
+  const buf = await buildMonthlySummaryWorkbook(stats, periodLabel, scopeLabel);
+  const filenameBase = `qir-summary-${year ?? 'recent'}${month ? `-${String(month).padStart(2, '0')}` : ''}`;
+
+  return new NextResponse(new Uint8Array(buf), {
+    headers: {
+      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
+      'Content-Disposition': `attachment; filename="${filenameBase}.xlsx"`,
+    },
+  });
+}
diff --git a/src/lib/exportExcel.ts b/src/lib/exportExcel.ts
index 2155f84..2214bbe 100644
--- a/src/lib/exportExcel.ts
+++ b/src/lib/exportExcel.ts
@@ -1,11 +1,15 @@
 import ExcelJS from 'exceljs';
-import { MqrRecord } from './types';
+import { MqrRecord, SEVERITY_LABELS, Severity, STATUS_LABELS, StatusValue } from './types';
+import { DashboardStats } from './db';
+import { formatMonthKeyThai } from './thaiDate';
 
 const LIST_COLUMNS: { header: string; key: string; width: number }[] = [
   { header: 'เลขที่งาน', key: 'job_id', width: 22 },
+  { header: 'ดีลเลอร์', key: 'dealer_id', width: 12 },
   { header: 'วันที่พบปัญหา', key: 'found_date', width: 14 },
   { header: 'รุ่นรถ', key: 'model', width: 16 },
   { header: 'หมายเลขรถ', key: 'serial', width: 18 },
+  { header: 'ความรุนแรง', key: 'severity', width: 14 },
   { header: 'ลูกค้า', key: 'customer_name', width: 20 },
   { header: 'เบอร์โทรลูกค้า', key: 'customer_phone', width: 14 },
   { header: 'อาการ', key: 'problem_code', width: 28 },
@@ -13,9 +17,16 @@ const LIST_COLUMNS: { header: string; key: string; width: number }[] = [
   { header: 'ชั่วโมงการใช้งาน', key: 'hours', width: 12 },
   { header: 'สถานะการรับประกัน', key: 'warranty_status', width: 18 },
   { header: 'สถานะงาน', key: 'status', width: 16 },
+  { header: 'สาขา', key: 'branch_name', width: 16 },
+  { header: 'ช่างผู้รับผิดชอบ', key: 'technician_name', width: 16 },
+  { header: 'วันที่ซ่อมเสร็จ', key: 'repair_date', width: 14 },
   { header: 'ผู้แจ้ง', key: 'reporter_name', width: 18 },
   { header: 'สาเหตุ', key: 'cause', width: 24 },
   { header: 'อะไหล่ที่เสียหาย', key: 'damaged_parts', width: 24 },
+  { header: 'อุปกรณ์ต่อพ่วง', key: 'peripheral_equipment', width: 20 },
+  { header: 'การดำเนินการของช่าง', key: 'technician_action', width: 24 },
+  { header: 'การแก้ไข (Corrective)', key: 'corrective_action', width: 24 },
+  { header: 'การป้องกัน (Preventive)', key: 'preventive_action', width: 24 },
   { header: 'ผู้บันทึก', key: 'user_name', width: 16 },
   { header: 'วันที่บันทึก', key: 'created_at', width: 18 },
 ];
@@ -39,19 +50,28 @@ export async function buildRecordsWorkbook(records: MqrRecord[]): Promise<ExcelJ
   for (const r of records) {
     sheet.addRow({
       job_id: r.job_id,
+      dealer_id: r.dealer_id ?? '',
       found_date: r.found_date ?? '',
       model: r.model ?? '',
       serial: r.serial ?? '',
+      severity: r.severity ? SEVERITY_LABELS[r.severity as Severity] ?? r.severity : '',
       customer_name: r.customer_name ?? '',
       customer_phone: r.customer_phone ?? '',
       problem_code: r.problem_code ?? '',
       problem_system: problemSystemLabel(r.problem_system),
       hours: r.hours ?? '',
       warranty_status: r.warranty_status ?? '',
-      status: r.status,
+      status: STATUS_LABELS[r.status as StatusValue] ?? r.status,
+      branch_name: r.branch_name ?? '',
+      technician_name: r.technician_name ?? '',
+      repair_date: r.repair_date ?? '',
       reporter_name: r.reporter_name ?? '',
       cause: r.cause ?? '',
       damaged_parts: r.damaged_parts ?? '',
+      peripheral_equipment: r.peripheral_equipment ?? '',
+      technician_action: r.technician_action ?? '',
+      corrective_action: r.corrective_action ?? '',
+      preventive_action: r.preventive_action ?? '',
       user_name: r.user_name ?? '',
       created_at: r.created_at ? new Date(r.created_at).toLocaleString('th-TH') : '',
     });
@@ -76,21 +96,30 @@ export async function buildSingleRecordWorkbook(
   const rows: [string, string][] = [
     ['เลขที่งาน', record.job_id],
     ['ดีลเลอร์', dealerName ?? record.dealer_id],
+    ['สาขา', record.branch_name ?? ''],
     ['หมายเลขรถ', record.serial ?? ''],
     ['รุ่นรถ', record.model ?? ''],
     ['ชั่วโมงการใช้งาน', record.hours !== null ? String(record.hours) : ''],
     ['วันที่พบปัญหา', record.found_date ?? ''],
     ['อาการที่พบ', record.problem_code ?? ''],
     ['ระบบ', problemSystemLabel(record.problem_system)],
+    ['ความรุนแรง', record.severity ? SEVERITY_LABELS[record.severity as Severity] ?? record.severity : ''],
     ['สถานะการรับประกัน', record.warranty_status ?? ''],
-    ['สถานะงาน', record.status],
+    ['สถานะงาน', STATUS_LABELS[record.status as StatusValue] ?? record.status],
     ['ชื่อลูกค้า', record.customer_name ?? ''],
     ['เบอร์โทรลูกค้า', record.customer_phone ?? ''],
     ['ชื่อผู้แจ้ง', record.reporter_name ?? ''],
     ['เบอร์โทรผู้แจ้ง', record.reporter_phone ?? ''],
     ['รายละเอียดปัญหา', record.attachment ?? ''],
+    ['อุปกรณ์ต่อพ่วง', record.peripheral_equipment ?? ''],
     ['สาเหตุ', record.cause ?? ''],
     ['อะไหล่ที่เสียหาย', record.damaged_parts ?? ''],
+    ['ช่างผู้รับผิดชอบ', record.technician_name ?? ''],
+    ['วันที่ซ่อมเสร็จ', record.repair_date ?? ''],
+    ['ชั่วโมงที่เข้ารับซ่อม', record.hours_in_for_repair !== null ? String(record.hours_in_for_repair) : ''],
+    ['การดำเนินการของช่าง', record.technician_action ?? ''],
+    ['การแก้ไข (Corrective Action)', record.corrective_action ?? ''],
+    ['การป้องกัน (Preventive Action)', record.preventive_action ?? ''],
     ['ที่มาของรถ (ถ้าไม่พบในระบบ)', record.stock_note ?? ''],
     ['พิกัด', record.lat !== null && record.lng !== null ? `${record.lat}, ${record.lng}` : ''],
     ['ผู้บันทึก', record.user_name ?? record.created_by ?? ''],
@@ -119,3 +148,162 @@ export async function buildSingleRecordWorkbook(
 
   return wb.xlsx.writeBuffer();
 }
+
+// ---------- Monthly summary report (Phase 7) ----------
+
+function styleSectionHeader(sheet: ExcelJS.Worksheet, rowNumber: number) {
+  const row = sheet.getRow(rowNumber);
+  row.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
+  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8102E' } };
+}
+
+function styleTableHeader(sheet: ExcelJS.Worksheet, rowNumber: number) {
+  const row = sheet.getRow(rowNumber);
+  row.font = { bold: true };
+  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
+}
+
+export async function buildMonthlySummaryWorkbook(
+  stats: DashboardStats,
+  periodLabel: string,
+  scopeLabel: string
+): Promise<ExcelJS.Buffer> {
+  const wb = new ExcelJS.Workbook();
+  wb.creator = 'QIMS';
+  wb.created = new Date();
+
+  // 1. KPI summary
+  const kpiSheet = wb.addWorksheet('สรุป KPI');
+  kpiSheet.columns = [{ width: 32 }, { width: 20 }, { width: 4 }, { width: 24 }, { width: 14 }];
+  kpiSheet.addRow(['รายงานสรุปประจำเดือน — Quality Issue Management System']);
+  kpiSheet.getRow(1).font = { bold: true, size: 14 };
+  kpiSheet.addRow([`ช่วงเวลา: ${periodLabel}`]);
+  kpiSheet.addRow([`ขอบเขต: ${scopeLabel}`]);
+  kpiSheet.addRow([`สร้างเมื่อ: ${new Date().toLocaleString('th-TH')}`]);
+  kpiSheet.addRow([]);
+
+  const kpiHeaderRow = kpiSheet.rowCount + 1;
+  kpiSheet.addRow(['ตัวชี้วัด (ตามช่วงเวลาที่เลือก)', 'ค่า']);
+  styleTableHeader(kpiSheet, kpiHeaderRow);
+  kpiSheet.addRow(['จำนวนงานทั้งหมดในช่วงเวลา', stats.totalAll]);
+  kpiSheet.addRow(['จำนวนงานเดือนนี้', stats.totalThisMonth]);
+  kpiSheet.addRow(['ซ่อมเสร็จ/ปิดงานแล้ว', stats.totalRepaired]);
+  kpiSheet.addRow(['รอชิ้นส่วน/อะไหล่', stats.totalWaitingParts]);
+  kpiSheet.addRow(['รถที่ซ่อมซ้ำ (มากกว่า 1 ครั้ง)', stats.repeatRepairCount]);
+  kpiSheet.addRow(['MTTR เฉลี่ย (วัน)', stats.mttrDays ?? '-']);
+  kpiSheet.addRow([]);
+
+  const backlogHeaderRow = kpiSheet.rowCount + 1;
+  kpiSheet.addRow(['ตัวชี้วัด (งานค้างปัจจุบัน — ไม่ขึ้นกับช่วงเวลาที่เลือก)', 'ค่า']);
+  styleTableHeader(kpiSheet, backlogHeaderRow);
+  kpiSheet.addRow(['งานค้างทั้งหมด (ยังไม่ปิด)', stats.totalOpen]);
+  kpiSheet.addRow(['งานที่เกิน SLA', stats.slaBreachCount]);
+  kpiSheet.addRow([]);
+
+  const statusHeaderRow = kpiSheet.rowCount + 1;
+  kpiSheet.addRow(['สถานะงานค้าง', 'จำนวน']);
+  styleTableHeader(kpiSheet, statusHeaderRow);
+  for (const s of stats.statusBacklog) {
+    kpiSheet.addRow([STATUS_LABELS[s.status as StatusValue] ?? s.status, s.count]);
+  }
+  kpiSheet.addRow([]);
+
+  const agingHeaderRow = kpiSheet.rowCount + 1;
+  kpiSheet.addRow(['งานค้างแยกตามอายุงาน', 'จำนวน']);
+  styleTableHeader(kpiSheet, agingHeaderRow);
+  for (const a of stats.agingBuckets) {
+    kpiSheet.addRow([a.bucket, a.count]);
+  }
+  kpiSheet.addRow([]);
+
+  const sevHeaderRow = kpiSheet.rowCount + 1;
+  kpiSheet.addRow(['งานในช่วงเวลาแยกตามความรุนแรง', 'จำนวน']);
+  styleTableHeader(kpiSheet, sevHeaderRow);
+  for (const s of stats.severityBreakdown) {
+    kpiSheet.addRow([s.severity, s.count]);
+  }
+
+  // 2. Monthly trend
+  const trendSheet = wb.addWorksheet('แนวโน้มรายเดือน');
+  trendSheet.columns = [{ width: 16 }, { width: 12 }];
+  trendSheet.addRow(['เดือน', 'จำนวนงาน']);
+  styleTableHeader(trendSheet, 1);
+  for (const m of stats.monthly) {
+    trendSheet.addRow([formatMonthKeyThai(m.month), m.count]);
+  }
+
+  // 3. Top problems (Pareto)
+  const paretoSheet = wb.addWorksheet('Top ปัญหา');
+  paretoSheet.columns = [{ width: 36 }, { width: 12 }, { width: 16 }];
+  paretoSheet.addRow(['อาการ/ปัญหา', 'จำนวนครั้ง', '% สะสม']);
+  styleTableHeader(paretoSheet, 1);
+  for (const p of stats.pareto) {
+    paretoSheet.addRow([p.label, p.count, `${p.cumulativePct}%`]);
+  }
+
+  // 4. Top parts
+  const partsSheet = wb.addWorksheet('Top อะไหล่');
+  partsSheet.columns = [{ width: 32 }, { width: 12 }];
+  partsSheet.addRow(['อะไหล่', 'จำนวนครั้งที่เปลี่ยน']);
+  styleTableHeader(partsSheet, 1);
+  for (const p of stats.topParts) {
+    partsSheet.addRow([p.label, p.count]);
+  }
+
+  // 5. By model
+  const modelSheet = wb.addWorksheet('ตามรุ่นรถ');
+  modelSheet.columns = [{ width: 20 }, { width: 12 }];
+  modelSheet.addRow(['รุ่นรถ', 'จำนวนงาน']);
+  styleTableHeader(modelSheet, 1);
+  for (const m of stats.byModel) {
+    modelSheet.addRow([m.model, m.count]);
+  }
+
+  // 6. Top aging jobs (current backlog)
+  const agingSheet = wb.addWorksheet('งานค้างนาน');
+  agingSheet.columns = [
+    { width: 22 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 16 }, { width: 12 }, { width: 12 },
+  ];
+  agingSheet.addRow(['เลขที่งาน', 'รุ่นรถ', 'หมายเลขรถ', 'ความรุนแรง', 'สถานะ', 'ค้างมาแล้ว (วัน)', 'เกิน SLA']);
+  styleTableHeader(agingSheet, 1);
+  for (const j of stats.topAgingJobs) {
+    agingSheet.addRow([
+      j.jobId,
+      j.model ?? '',
+      j.serial ?? '',
+      j.severity ? SEVERITY_LABELS[j.severity as Severity] ?? j.severity : '',
+      STATUS_LABELS[j.status as StatusValue] ?? j.status,
+      j.daysOpen,
+      j.slaBreached ? 'เกิน SLA' : '',
+    ]);
+  }
+
+  // 7. Leaderboards
+  const lbSheet = wb.addWorksheet('อันดับ');
+  lbSheet.columns = [{ width: 22 }, { width: 12 }, { width: 16 }];
+
+  function addLeaderboardBlock(title: string, entries: DashboardStats['branchLeaderboard']) {
+    const headerRowNum = lbSheet.rowCount + 1;
+    lbSheet.addRow([title]);
+    styleSectionHeader(lbSheet, headerRowNum);
+    const colHeaderRowNum = lbSheet.rowCount + 1;
+    lbSheet.addRow(['ชื่อ', 'จำนวนงาน', 'MTTR เฉลี่ย (วัน)']);
+    styleTableHeader(lbSheet, colHeaderRowNum);
+    if (entries.length === 0) {
+      lbSheet.addRow(['ไม่มีข้อมูล', '', '']);
+    } else {
+      for (const e of entries) {
+        lbSheet.addRow([e.label, e.count, e.mttrDays ?? '-']);
+      }
+    }
+    lbSheet.addRow([]);
+  }
+
+  if (stats.dealerLeaderboard.length > 0) {
+    addLeaderboardBlock('อันดับดีลเลอร์ (Top 10)', stats.dealerLeaderboard);
+  }
+  addLeaderboardBlock('อันดับสาขา (Top 10)', stats.branchLeaderboard);
+  addLeaderboardBlock('อันดับช่าง (Top 10)', stats.technicianLeaderboard);
+
+  return wb.xlsx.writeBuffer();
+}
diff --git a/src/lib/exportPdf.tsx b/src/lib/exportPdf.tsx
index deb055f..ccf493a 100644
--- a/src/lib/exportPdf.tsx
+++ b/src/lib/exportPdf.tsx
@@ -68,13 +68,15 @@ function problemSystemLabel(s: string | null) {
 }
 
 const LIST_COLS: { key: keyof MqrRecord | 'vehicle'; label: string; width: string }[] = [
-  { key: 'job_id', label: 'เลขที่งาน', width: '13%' },
-  { key: 'found_date', label: 'วันที่พบ', width: '9%' },
-  { key: 'vehicle', label: 'รถ / Serial', width: '17%' },
-  { key: 'customer_name', label: 'ลูกค้า', width: '14%' },
-  { key: 'problem_code', label: 'อาการ', width: '23%' },
-  { key: 'warranty_status', label: 'ประกัน', width: '12%' },
-  { key: 'status', label: 'สถานะ', width: '12%' },
+  { key: 'job_id', label: 'เลขที่งาน', width: '11%' },
+  { key: 'dealer_id', label: 'ดีลเลอร์', width: '8%' },
+  { key: 'found_date', label: 'วันที่พบ', width: '8%' },
+  { key: 'vehicle', label: 'รถ / Serial', width: '14%' },
+  { key: 'severity', label: 'ความรุนแรง', width: '9%' },
+  { key: 'customer_name', label: 'ลูกค้า', width: '12%' },
+  { key: 'problem_code', label: 'อาการ', width: '20%' },
+  { key: 'warranty_status', label: 'ประกัน', width: '9%' },
+  { key: 'status', label: 'สถานะ', width: '9%' },
 ];
 
 function RecordsListDocument({ records, title }: { records: MqrRecord[]; title: string }) {
@@ -96,14 +98,18 @@ function RecordsListDocument({ records, title }: { records: MqrRecord[]; title:
           {records.map((r) => (
             <View style={styles.row} key={r.id} wrap={false}>
               <Text style={[styles.cell, { width: LIST_COLS[0].width }]}>{r.job_id}</Text>
-              <Text style={[styles.cell, { width: LIST_COLS[1].width }]}>{r.found_date ?? '-'}</Text>
-              <Text style={[styles.cell, { width: LIST_COLS[2].width }]}>
+              <Text style={[styles.cell, { width: LIST_COLS[1].width }]}>{r.dealer_id ?? '-'}</Text>
+              <Text style={[styles.cell, { width: LIST_COLS[2].width }]}>{r.found_date ?? '-'}</Text>
+              <Text style={[styles.cell, { width: LIST_COLS[3].width }]}>
                 {r.model ?? '-'} ({r.serial ?? '-'})
               </Text>
-              <Text style={[styles.cell, { width: LIST_COLS[3].width }]}>{r.customer_name ?? '-'}</Text>
-              <Text style={[styles.cell, { width: LIST_COLS[4].width }]}>{r.problem_code ?? '-'}</Text>
-              <Text style={[styles.cell, { width: LIST_COLS[5].width }]}>{r.warranty_status ?? '-'}</Text>
-              <Text style={[styles.cell, { width: LIST_COLS[6].width }]}>{r.status}</Text>
+              <Text style={[styles.cell, { width: LIST_COLS[4].width }]}>
+                {r.severity ? SEVERITY_LABELS[r.severity as Severity] ?? r.severity : '-'}
+              </Text>
+              <Text style={[styles.cell, { width: LIST_COLS[5].width }]}>{r.customer_name ?? '-'}</Text>
+              <Text style={[styles.cell, { width: LIST_COLS[6].width }]}>{r.problem_code ?? '-'}</Text>
+              <Text style={[styles.cell, { width: LIST_COLS[7].width }]}>{r.warranty_status ?? '-'}</Text>
+              <Text style={[styles.cell, { width: LIST_COLS[8].width }]}>{r.status}</Text>
             </View>
           ))}
         </View>
-- 
2.34.1

