/**
 * Maintenance (PM Record) — PDF export.
 *
 * Mirrors lib/exportPdf.tsx's (MQR) document structure and reuses its
 * shared infrastructure (font registration, remote-image resolution, the
 * corporate logo slot, the brand-red color) rather than re-implementing
 * any of it - see lib/pdf/. Per the Production Stabilization Sprint's PDF
 * checklist: corporate header, Mahindra logo, QR code, no empty sections,
 * Thai text wrapping, professional spacing, photos shown only when
 * present.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { ensureFontsRegistered } from '@/lib/pdf/fonts';
import { fetchImageAsDataUri } from '@/lib/pdf/fetchImage';
import { PdfBrandLogo } from '@/lib/pdf/PdfBrandLogo';
import { PDF_BRAND_RED } from '@/lib/pdf/brand';
import { formatThaiDateTime } from '@/lib/thaiDate';
import { MaintenanceRecord, maintenanceAttachmentsOf, MaintenanceAttachmentKind } from '../types';
import { evaluateMaintenanceLock, MAINTENANCE_LOCK_REASON_LABEL } from '../utils/maintenanceLock';

const ATTACHMENT_LABEL: Record<MaintenanceAttachmentKind, string> = {
  meter: 'รูปมิเตอร์ชั่วโมง',
  nameplate: 'รูป Nameplate / หมายเลขเครื่อง',
  report: 'รูปใบรายงาน PM',
};

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Sarabun', fontSize: 9, color: '#1a1a1a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: 'bold', marginBottom: 2, color: PDF_BRAND_RED },
  titleRule: { borderBottomWidth: 2, borderColor: PDF_BRAND_RED, marginTop: 6, marginBottom: 10 },
  subtitle: { fontSize: 9, color: '#666', marginBottom: 2 },
  qr: { width: 56, height: 56 },
  qrCaption: { fontSize: 6, color: '#999', textAlign: 'center', marginTop: 2, width: 56 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, color: '#fff', backgroundColor: '#555' },
  lockedBadge: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, color: '#7a4a00', backgroundColor: '#fde9c8' },

  infoTable: { borderWidth: 1, borderColor: '#ccc', marginTop: 4 },
  infoRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e5e5' },
  infoCellLabel: {
    width: '17%',
    backgroundColor: '#f3f3f3',
    padding: 5,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#444',
    borderRightWidth: 1,
    borderColor: '#e5e5e5',
  },
  infoCellValue: { width: '33%', padding: 5, fontSize: 8.5, borderRightWidth: 1, borderColor: '#e5e5e5' },
  infoCellValueLast: { width: '33%', padding: 5, fontSize: 8.5 },
  infoCellValueFull: { width: '83%', padding: 5, fontSize: 8.5 },

  section: { marginTop: 10, marginBottom: 4 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: PDF_BRAND_RED },
  paragraph: { fontSize: 9, lineHeight: 1.4 },
  link: { fontSize: 8.5, color: '#1a56db' },

  photoCategoryLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: PDF_BRAND_RED,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 6,
    marginTop: 10,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoBox: { width: 150, marginBottom: 8, borderWidth: 1, borderColor: '#ddd', padding: 3 },
  photo: { width: 142, height: 110, objectFit: 'cover' },
  photoPlaceholder: { width: 142, height: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' },
  photoPlaceholderText: { fontSize: 7, color: '#aaa' },
  photoLabel: { fontSize: 7, marginTop: 3, textAlign: 'center', color: '#555' },

  auditText: { fontSize: 7, color: '#999' },
  issuedText: { fontSize: 7, color: '#999', marginTop: 2 },
  footer: { position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#999', textAlign: 'right' },
});

function fmt(v?: string | number | null): string {
  return v !== null && v !== undefined && v !== '' ? String(v) : '-';
}

function Row2({ l1, v1, l2, v2 }: { l1: string; v1?: string | number | null; l2: string; v2?: string | number | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoCellLabel}>{l1}</Text>
      <Text style={styles.infoCellValue}>{fmt(v1)}</Text>
      <Text style={styles.infoCellLabel}>{l2}</Text>
      <Text style={styles.infoCellValueLast}>{fmt(v2)}</Text>
    </View>
  );
}

function RowFull({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <Text style={[styles.infoCellValueFull, { fontSize: 8.5 }]}>{fmt(value)}</Text>
    </View>
  );
}

interface MaintenanceDocumentProps {
  record: MaintenanceRecord;
  dealerName?: string;
  intervalLabel?: string;
  qrDataUrl: string;
  recordUrl: string;
  photoDataUris: Map<string, string | null>;
}

function MaintenanceDocument({ record, dealerName, intervalLabel, qrDataUrl, recordUrl, photoDataUris }: MaintenanceDocumentProps) {
  const lock = evaluateMaintenanceLock(record);
  const attachments = maintenanceAttachmentsOf(record);
  const hasGps = record.latitude !== null && record.longitude !== null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <PdfBrandLogo />
            <Text style={styles.title}>ใบรายงานบำรุงรักษาเชิงป้องกัน (Preventive Maintenance Report)</Text>
            <Text style={styles.subtitle}>
              เลขที่ PM {record.pm_number ?? record.id} — {dealerName ?? record.dealer_id}
            </Text>
            <Text style={styles.subtitle}>พิมพ์เมื่อ {formatThaiDateTime(new Date())}</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{record.status}</Text>
              {lock.locked && (
                <Text style={styles.lockedBadge}>🔒 {MAINTENANCE_LOCK_REASON_LABEL[lock.reason!]}</Text>
              )}
            </View>
          </View>
          <View>
            <Image src={qrDataUrl} style={styles.qr} />
            <Text style={styles.qrCaption}>สแกนเพื่อเปิดรายงาน</Text>
          </View>
        </View>
        <View style={styles.titleRule} />

        <View style={styles.infoTable}>
          <Row2 l1="รุ่นรถ" v1={record.model} l2="หมายเลขรถ (Serial)" v2={record.serial} />
          <Row2 l1="หมายเลขเครื่อง" v1={record.engine_number} l2="วันที่ส่งมอบ" v2={record.delivery_date} />
          <Row2 l1="ชื่อลูกค้า" v1={record.customer_name} l2="เบอร์โทรลูกค้า" v2={record.customer_phone} />
          <Row2 l1="ช่างซ่อม" v1={record.technician_name} l2="สาขา" v2={record.branch_name} />
          <Row2 l1="วันที่ทำ PM" v1={record.performed_date} l2="ชั่วโมงเครื่องยนต์" v2={record.hour_meter} />
          <Row2 l1="รอบ PM" v1={intervalLabel} l2="รอบ PM ถัดไป" v2={record.next_pm_due} />
          {record.notes && <RowFull label="หมายเหตุ" value={record.notes} />}
        </View>

        {hasGps && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>พิกัดสถานที่</Text>
            <Text style={styles.paragraph}>
              {record.latitude}, {record.longitude}
              {record.gps_accuracy !== null ? ` (ความแม่นยำ ±${Math.round(record.gps_accuracy)} m)` : ''}
            </Text>
            {record.google_maps_url && <Text style={styles.link}>{record.google_maps_url}</Text>}
          </View>
        )}

        {attachments.map((a) => {
          const dataUri = photoDataUris.get(a.url);
          return (
            <View key={a.kind}>
              <Text style={styles.photoCategoryLabel}>{ATTACHMENT_LABEL[a.kind]}</Text>
              <View style={styles.photoGrid}>
                <View style={styles.photoBox} wrap={false}>
                  {dataUri ? (
                    <Image src={dataUri} style={styles.photo} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>โหลดรูปไม่สำเร็จ</Text>
                    </View>
                  )}
                  <Text style={styles.photoLabel}>{ATTACHMENT_LABEL[a.kind]}</Text>
                </View>
              </View>
            </View>
          );
        })}

        <View style={{ marginTop: 10 }}>
          <Text style={styles.auditText}>
            สร้างโดย {record.created_by ?? '-'} · {formatThaiDateTime(record.created_at)}
            {record.updated_by ? ` — แก้ไขล่าสุดโดย ${record.updated_by} · ${formatThaiDateTime(record.updated_at)}` : ''}
          </Text>
          <Text style={styles.issuedText}>เอกสารออกเมื่อ {formatThaiDateTime(new Date())} โดยระบบ PM</Text>
        </View>

        <Text style={styles.footer}>{recordUrl}</Text>
      </Page>
    </Document>
  );
}

const LIST_COLS: { key: string; label: string; width: string; value: (r: MaintenanceRecord) => string }[] = [
  { key: 'pm_number', label: 'เลขที่ PM', width: '14%', value: (r) => r.pm_number ?? '-' },
  { key: 'dealer_id', label: 'ดีลเลอร์', width: '9%', value: (r) => r.dealer_id },
  { key: 'performed_date', label: 'วันที่ทำ PM', width: '9%', value: (r) => r.performed_date ?? '-' },
  { key: 'vehicle', label: 'รถ / Serial', width: '15%', value: (r) => `${r.model ?? '-'} (${r.serial ?? '-'})` },
  { key: 'customer_name', label: 'ลูกค้า', width: '13%', value: (r) => r.customer_name ?? '-' },
  { key: 'technician_name', label: 'ช่างซ่อม', width: '13%', value: (r) => r.technician_name ?? '-' },
  { key: 'hour_meter', label: 'ชั่วโมง', width: '9%', value: (r) => (r.hour_meter != null ? String(r.hour_meter) : '-') },
  { key: 'status', label: 'สถานะ', width: '9%', value: (r) => r.status },
  { key: 'next_pm_due', label: 'รอบถัดไป', width: '9%', value: (r) => r.next_pm_due ?? '-' },
];

const listStyles = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Sarabun', fontSize: 9, color: '#1a1a1a' },
  title: { fontSize: 15, fontWeight: 'bold', marginBottom: 2, color: PDF_BRAND_RED },
  subtitle: { fontSize: 9, color: '#666', marginBottom: 8 },
  table: { width: '100%', borderWidth: 1, borderColor: '#ddd' },
  rowHeader: { flexDirection: 'row', backgroundColor: '#f3f3f3', borderBottomWidth: 1, borderColor: '#ccc' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
  cellHeader: { padding: 4, fontWeight: 'bold', fontSize: 8 },
  cell: { padding: 4, fontSize: 8 },
});

function MaintenanceListDocument({ records, title }: { records: MaintenanceRecord[]; title: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={listStyles.page}>
        <PdfBrandLogo />
        <Text style={listStyles.title}>PM History Report</Text>
        <Text style={listStyles.subtitle}>
          {title} — พิมพ์เมื่อ {formatThaiDateTime(new Date())} — จำนวน {records.length} รายการ
        </Text>
        <View style={listStyles.table}>
          <View style={listStyles.rowHeader}>
            {LIST_COLS.map((c) => (
              <Text key={c.key} style={[listStyles.cellHeader, { width: c.width }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {records.map((r) => (
            <View style={listStyles.row} key={r.id} wrap={false}>
              {LIST_COLS.map((c) => (
                <Text key={c.key} style={[listStyles.cell, { width: c.width }]}>
                  {c.value(r)}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

/** Resolves every attachment's URL on a record to a data URI in parallel. */
async function resolveAttachmentDataUris(record: MaintenanceRecord): Promise<Map<string, string | null>> {
  const urls = maintenanceAttachmentsOf(record).map((a) => a.url);
  const resolved = await Promise.all(urls.map((u) => fetchImageAsDataUri(u)));
  return new Map(urls.map((u, i) => [u, resolved[i]]));
}

export async function renderMaintenanceRecordPdf(
  record: MaintenanceRecord,
  baseUrl: string,
  options?: { dealerName?: string; intervalLabel?: string }
): Promise<Buffer> {
  ensureFontsRegistered();
  const recordUrl = `${baseUrl}/pm-records/${encodeURIComponent(record.id)}`;
  const [qrDataUrl, photoDataUris] = await Promise.all([
    QRCode.toDataURL(recordUrl, { margin: 0, width: 160 }),
    resolveAttachmentDataUris(record),
  ]);
  return renderToBuffer(
    <MaintenanceDocument
      record={record}
      dealerName={options?.dealerName}
      intervalLabel={options?.intervalLabel}
      qrDataUrl={qrDataUrl}
      recordUrl={recordUrl}
      photoDataUris={photoDataUris}
    />
  );
}

export async function renderMaintenanceListPdf(records: MaintenanceRecord[], title: string): Promise<Buffer> {
  ensureFontsRegistered();
  return renderToBuffer(<MaintenanceListDocument records={records} title={title} />);
}
