import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, Image, renderToBuffer } from '@react-pdf/renderer';
import { MqrRecord } from './types';

let fontsRegisteredFor: string | null = null;

/**
 * Fonts must be registered with an absolute URL react-pdf can fetch at
 * render time. We serve them from /public so the URL is always valid on
 * Vercel regardless of serverless file-tracing (a local fs path would be
 * fragile there). `baseUrl` is derived per-request from the incoming
 * NextRequest origin, so this re-registers if it ever differs (custom
 * domain vs. *.vercel.app preview, etc).
 */
function ensureFontsRegistered(baseUrl: string) {
  if (fontsRegisteredFor === baseUrl) return;
  Font.register({
    family: 'Sarabun',
    fonts: [
      { src: `${baseUrl}/fonts/Sarabun-Regular.woff`, fontWeight: 'normal' },
      { src: `${baseUrl}/fonts/Sarabun-Bold.woff`, fontWeight: 'bold' },
    ],
  });
  fontsRegisteredFor = baseUrl;
}

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Sarabun', fontSize: 9, color: '#1a1a1a' },
  title: { fontSize: 14, fontWeight: 'bold', marginBottom: 2, color: '#9c1c1c' },
  subtitle: { fontSize: 9, color: '#666', marginBottom: 10 },
  table: { width: '100%', borderWidth: 1, borderColor: '#ddd' },
  rowHeader: { flexDirection: 'row', backgroundColor: '#f3f3f3', borderBottomWidth: 1, borderColor: '#ccc' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
  cellHeader: { padding: 4, fontWeight: 'bold', fontSize: 8 },
  cell: { padding: 4, fontSize: 8 },
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#9c1c1c' },
  fieldRow: { flexDirection: 'row', marginBottom: 3 },
  fieldLabel: { width: 130, fontWeight: 'bold', fontSize: 9 },
  fieldValue: { flex: 1, fontSize: 9 },
  paragraph: { fontSize: 9, lineHeight: 1.4 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoBox: { width: 110, marginBottom: 8 },
  photo: { width: 110, height: 90, objectFit: 'cover', borderWidth: 1, borderColor: '#ddd' },
  photoLabel: { fontSize: 7, marginTop: 2, textAlign: 'center', color: '#555' },
  footer: { position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#999', textAlign: 'right' },
});

function problemSystemLabel(s: string | null) {
  if (s === 'powertrain') return 'Powertrain (48 เดือน)';
  if (s) return 'อื่นๆ (24 เดือน)';
  return '-';
}

const LIST_COLS: { key: keyof MqrRecord | 'vehicle'; label: string; width: string }[] = [
  { key: 'job_id', label: 'เลขที่งาน', width: '13%' },
  { key: 'found_date', label: 'วันที่พบ', width: '9%' },
  { key: 'vehicle', label: 'รถ / Serial', width: '17%' },
  { key: 'customer_name', label: 'ลูกค้า', width: '14%' },
  { key: 'problem_code', label: 'อาการ', width: '23%' },
  { key: 'warranty_status', label: 'ประกัน', width: '12%' },
  { key: 'status', label: 'สถานะ', width: '12%' },
];

function RecordsListDocument({ records, title }: { records: MqrRecord[]; title: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Market Quality Report</Text>
        <Text style={styles.subtitle}>
          {title} — พิมพ์เมื่อ {new Date().toLocaleString('th-TH')} — จำนวน {records.length} งาน
        </Text>
        <View style={styles.table}>
          <View style={styles.rowHeader}>
            {LIST_COLS.map((c) => (
              <Text key={c.key} style={[styles.cellHeader, { width: c.width }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {records.map((r) => (
            <View style={styles.row} key={r.id} wrap={false}>
              <Text style={[styles.cell, { width: LIST_COLS[0].width }]}>{r.job_id}</Text>
              <Text style={[styles.cell, { width: LIST_COLS[1].width }]}>{r.found_date ?? '-'}</Text>
              <Text style={[styles.cell, { width: LIST_COLS[2].width }]}>
                {r.model ?? '-'} ({r.serial ?? '-'})
              </Text>
              <Text style={[styles.cell, { width: LIST_COLS[3].width }]}>{r.customer_name ?? '-'}</Text>
              <Text style={[styles.cell, { width: LIST_COLS[4].width }]}>{r.problem_code ?? '-'}</Text>
              <Text style={[styles.cell, { width: LIST_COLS[5].width }]}>{r.warranty_status ?? '-'}</Text>
              <Text style={[styles.cell, { width: LIST_COLS[6].width }]}>{r.status}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

function FieldRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value !== null && value !== undefined && value !== '' ? String(value) : '-'}</Text>
    </View>
  );
}

function RecordDocument({ record, dealerName }: { record: MqrRecord; dealerName?: string }) {
  const allPhotos = [
    ...(record.photo_links ?? []),
    ...(record.after_photo_link ? [{ label: 'หลังซ่อม', url: record.after_photo_link }] : []),
  ];
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>ใบรายงานปัญหาคุณภาพ (MQR)</Text>
        <Text style={styles.subtitle}>
          {record.job_id} — {dealerName ?? record.dealer_id}
        </Text>

        <View style={styles.section}>
          <FieldRow label="หมายเลขรถ" value={record.serial} />
          <FieldRow label="รุ่นรถ" value={record.model} />
          <FieldRow label="ชั่วโมงการใช้งาน" value={record.hours} />
          <FieldRow label="วันที่พบปัญหา" value={record.found_date} />
          <FieldRow label="อาการที่พบ" value={record.problem_code} />
          <FieldRow label="ระบบ" value={problemSystemLabel(record.problem_system)} />
          <FieldRow label="สถานะการรับประกัน" value={record.warranty_status} />
          <FieldRow label="สถานะงาน" value={record.status} />
          <FieldRow label="ลูกค้า" value={[record.customer_name, record.customer_phone].filter(Boolean).join(' / ')} />
          <FieldRow label="ผู้แจ้ง" value={[record.reporter_name, record.reporter_phone].filter(Boolean).join(' / ')} />
          {record.stock_note && <FieldRow label="ที่มาของรถ" value={record.stock_note} />}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>รายละเอียดปัญหาที่ลูกค้าพบ</Text>
          <Text style={styles.paragraph}>{record.attachment || '-'}</Text>
        </View>

        {record.cause && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>สาเหตุ</Text>
            <Text style={styles.paragraph}>{record.cause}</Text>
          </View>
        )}

        {record.damaged_parts && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>อะไหล่ที่เสียหาย</Text>
            <Text style={styles.paragraph}>{record.damaged_parts}</Text>
          </View>
        )}

        {allPhotos.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>รูปภาพ</Text>
            <View style={styles.photoGrid}>
              {allPhotos.map((p, i) => (
                <View key={i} style={styles.photoBox}>
                  {/* react-pdf fetches remote image URLs itself at render time */}
                  <Image src={p.url} style={styles.photo} />
                  <Text style={styles.photoLabel}>{p.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.footer}>พิมพ์เมื่อ {new Date().toLocaleString('th-TH')}</Text>
      </Page>
    </Document>
  );
}

export async function renderRecordsListPdf(
  records: MqrRecord[],
  title: string,
  baseUrl: string
): Promise<Buffer> {
  ensureFontsRegistered(baseUrl);
  return renderToBuffer(<RecordsListDocument records={records} title={title} />);
}

export async function renderRecordPdf(
  record: MqrRecord,
  baseUrl: string,
  dealerName?: string
): Promise<Buffer> {
  ensureFontsRegistered(baseUrl);
  return renderToBuffer(<RecordDocument record={record} dealerName={dealerName} />);
}
