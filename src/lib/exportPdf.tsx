import React from 'react';
import fs from 'fs';
import path from 'path';
import { Document, Page, Text, View, StyleSheet, Font, Image, Link, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import {
  MqrRecord,
  SEVERITY_LABELS,
  Severity,
  PHOTO_CATEGORIES,
  STATUS_LABELS,
  StatusValue,
} from './types';
import { formatThaiDateTime } from './thaiDate';

let fontsRegistered = false;

/**
 * Fonts are read directly from disk (as Buffers) instead of being fetched
 * over HTTP. We previously registered them with an absolute URL
 * (`${baseUrl}/fonts/*.ttf`) for react-pdf to fetch at render time, but
 * that self-fetch happens server-side, with no browser session attached -
 * and this Vercel project has Deployment Protection enabled, which
 * intercepts ANY unauthenticated request to the deployment, including the
 * app's own outbound fetch back to itself, and returns the Vercel SSO
 * login page instead of the font file. fontkit then tried to parse that
 * login page's HTML as a font and threw "Unknown font format" - on every
 * single export, for both the original WOFF files and the TTF files they
 * were converted to, regardless of how `baseUrl`/origin was derived.
 * (Confirmed via a temporary debug route that fetched the exact same URL
 * server-side and logged the response: status 200, but the body was the
 * Vercel SSO HTML page, not font bytes.)
 *
 * Reading the files from the filesystem sidesteps HTTP - and Deployment
 * Protection - entirely. For this to work inside the Vercel serverless
 * function, the files under /public/fonts must be explicitly included in
 * the function's file trace (see `outputFileTracingIncludes` in
 * next.config.mjs) - by default Next does not bundle /public into
 * serverless functions, since it's normally served separately via the CDN.
 */
function ensureFontsRegistered() {
  if (fontsRegistered) return;
  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  Font.register({
    family: 'Sarabun',
    fonts: [
      { src: fs.readFileSync(path.join(fontsDir, 'Sarabun-Regular.ttf')), fontWeight: 'normal' },
      { src: fs.readFileSync(path.join(fontsDir, 'Sarabun-Bold.ttf')), fontWeight: 'bold' },
    ],
  });
  fontsRegistered = true;
}

/**
 * react-pdf's <Image src={remoteUrl}> fetches the URL itself at render
 * time, with no control over headers/timeout/retries and no way to
 * substitute a placeholder on failure - one bad fetch throws and takes
 * down the whole PDF (this is what caused the export 500 after switching
 * photo URLs to Drive's `thumbnail?id=...` endpoint, which - unlike a
 * normal <img> tag in a browser - can reject a plain server-side fetch
 * with no browser-like User-Agent/Accept headers).
 *
 * To make this robust, we fetch every photo ourselves up front (with a
 * timeout, a normal browser UA, and a try/catch per image) and hand
 * react-pdf an already-resolved base64 data: URI instead. A failed fetch
 * degrades to a "image failed to load" placeholder rather than crashing
 * the export.
 */
async function fetchImageAsDataUri(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          Accept: 'image/*',
        },
      });
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) return null;
      return `data:${contentType};base64,${buf.toString('base64')}`;
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return null;
  }
}

/** Resolves every photo URL on a record to a data URI in parallel, keyed by the original URL. */
async function resolvePhotoDataUris(record: MqrRecord): Promise<Map<string, string | null>> {
  const urls = (record.photo_links ?? []).map((p) => p.url);
  const resolved = await Promise.all(urls.map((u) => fetchImageAsDataUri(u)));
  return new Map(urls.map((u, i) => [u, resolved[i]]));
}

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Sarabun', fontSize: 9, color: '#1a1a1a' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: 'bold', marginBottom: 2, color: '#9c1c1c' },
  titleRule: { borderBottomWidth: 2, borderColor: '#9c1c1c', marginTop: 6, marginBottom: 10 },
  subtitle: { fontSize: 9, color: '#666', marginBottom: 2 },
  qr: { width: 56, height: 56 },
  qrCaption: { fontSize: 6, color: '#999', textAlign: 'center', marginTop: 2, width: 56 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, color: '#fff' },

  // Bulk/list export (renderRecordsListPdf) - unchanged from the original
  // table layout, kept separate from the single-record info table below.
  table: { width: '100%', borderWidth: 1, borderColor: '#ddd' },
  rowHeader: { flexDirection: 'row', backgroundColor: '#f3f3f3', borderBottomWidth: 1, borderColor: '#ccc' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
  cellHeader: { padding: 4, fontWeight: 'bold', fontSize: 8 },
  cell: { padding: 4, fontSize: 8 },

  section: { marginTop: 8, marginBottom: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#9c1c1c' },
  paragraph: { fontSize: 9, lineHeight: 1.4 },
  link: { fontSize: 8.5, color: '#1a56db' },

  // Single-record info table - a bordered grid (label/value pairs, two per
  // row, with long-text fields spanning the full row) modeled after the
  // legacy MSEAL/Tractor-PM report layouts the dealers are used to.
  infoTable: { borderWidth: 1, borderColor: '#ccc' },
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
  rcaHeaderRow: { backgroundColor: '#fbeaea', padding: 5, borderBottomWidth: 1, borderColor: '#e5c5c5' },
  rcaHeaderText: { fontSize: 9, fontWeight: 'bold', color: '#9c1c1c' },

  photoCategoryLabel: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#fff',
    backgroundColor: '#9c1c1c',
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 6,
    marginTop: 10,
  },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoBox: { width: 120, marginBottom: 8, borderWidth: 1, borderColor: '#ddd', padding: 3 },
  photo: { width: 112, height: 92, objectFit: 'cover' },
  photoPlaceholder: {
    width: 112,
    height: 92,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  photoPlaceholderText: { fontSize: 7, color: '#aaa' },
  photoLabel: { fontSize: 7, marginTop: 3, textAlign: 'center', color: '#555' },

  auditText: { fontSize: 7, color: '#999' },
  issuedText: { fontSize: 7, color: '#999', marginTop: 2 },
  footer: { position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#999', textAlign: 'right' },
});

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

const LIST_COLS: { key: keyof MqrRecord | 'vehicle'; label: string; width: string }[] = [
  { key: 'job_id', label: 'เลขที่งาน', width: '11%' },
  { key: 'dealer_id', label: 'ดีลเลอร์', width: '8%' },
  { key: 'found_date', label: 'วันที่พบ', width: '8%' },
  { key: 'vehicle', label: 'รถ / Serial', width: '14%' },
  { key: 'severity', label: 'ความรุนแรง', width: '9%' },
  { key: 'customer_name', label: 'ลูกค้า', width: '12%' },
  { key: 'problem_code', label: 'อาการ', width: '20%' },
  { key: 'warranty_status', label: 'ประกัน', width: '9%' },
  { key: 'status', label: 'สถานะ', width: '9%' },
];

function RecordsListDocument({ records, title }: { records: MqrRecord[]; title: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Market Quality Report</Text>
        <Text style={styles.subtitle}>
          {title} — พิมพ์เมื่อ {formatThaiDateTime(new Date())} — จำนวน {records.length} งาน
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
              <Text style={[styles.cell, { width: LIST_COLS[1].width }]}>{r.dealer_id ?? '-'}</Text>
              <Text style={[styles.cell, { width: LIST_COLS[2].width }]}>{r.found_date ?? '-'}</Text>
              <Text style={[styles.cell, { width: LIST_COLS[3].width }]}>
                {r.model ?? '-'} ({r.serial ?? '-'})
              </Text>
              <Text style={[styles.cell, { width: LIST_COLS[4].width }]}>
                {r.severity ? SEVERITY_LABELS[r.severity as Severity] ?? r.severity : '-'}
              </Text>
              <Text style={[styles.cell, { width: LIST_COLS[5].width }]}>{r.customer_name ?? '-'}</Text>
              <Text style={[styles.cell, { width: LIST_COLS[6].width }]}>{r.problem_code ?? '-'}</Text>
              <Text style={[styles.cell, { width: LIST_COLS[7].width }]}>{r.warranty_status ?? '-'}</Text>
              <Text style={[styles.cell, { width: LIST_COLS[8].width }]}>{r.status}</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
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
    <View style={styles.infoRow}>
      <Text style={styles.infoCellLabel}>{l1}</Text>
      <Text style={styles.infoCellValue}>{fmt(v1)}</Text>
      <Text style={styles.infoCellLabel}>{l2}</Text>
      <Text style={styles.infoCellValueLast}>{fmt(v2)}</Text>
    </View>
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
    <View style={styles.infoRow}>
      <Text style={styles.infoCellLabel}>{label}</Text>
      <View style={styles.infoCellValueFull}>
        {children ?? <Text style={{ fontSize: 8.5 }}>{fmt(value)}</Text>}
      </View>
    </View>
  );
}

function RecordDocument({
  record,
  dealerName,
  qrDataUrl,
  recordUrl,
  photoDataUris,
}: {
  record: MqrRecord;
  dealerName?: string;
  qrDataUrl: string;
  recordUrl: string;
  photoDataUris: Map<string, string | null>;
}) {
  const statusLabel = STATUS_LABELS[record.status as StatusValue] ?? record.status;
  const hasRca =
    record.cause || record.damaged_parts || record.technician_action || record.corrective_action || record.preventive_action;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>ใบรายงานปัญหาคุณภาพ (Market Quality Report)</Text>
            <Text style={styles.subtitle}>
              เลขที่งาน {record.job_id} — {dealerName ?? record.dealer_id}
            </Text>
            <Text style={styles.subtitle}>พิมพ์เมื่อ {formatThaiDateTime(new Date())}</Text>
            <View style={styles.badgeRow}>
              <Text style={[styles.badge, { backgroundColor: '#555' }]}>{statusLabel}</Text>
              {record.severity && (
                <Text style={[styles.badge, { backgroundColor: SEVERITY_COLORS[record.severity as Severity] }]}>
                  {SEVERITY_LABELS[record.severity as Severity]}
                </Text>
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
          <Row2 l1="ระบบ" v1={problemSystemLabel(record.problem_system)} l2="สถานะการรับประกัน" v2={record.warranty_status} />
          <RowFull label="อาการที่พบ" value={record.problem_code} />
          {record.peripheral_equipment && <RowFull label="อุปกรณ์ต่อพ่วงที่ใช้งาน" value={record.peripheral_equipment} />}
          {record.stock_note && <RowFull label="ที่มาของรถ" value={record.stock_note} />}
          {record.lat !== null && record.lng !== null && (
            <RowFull label="พิกัดภูมิศาสตร์ (GPS)">
              <Link
                style={styles.link}
                src={`https://www.openstreetmap.org/?mlat=${record.lat}&mlon=${record.lng}#map=16/${record.lat}/${record.lng}`}
              >
                {record.lat}, {record.lng} (เปิดแผนที่ OpenStreetMap)
              </Link>
            </RowFull>
          )}
          {record.video_link && (
            <RowFull label="วิดีโอปัญหา">
              <Link style={styles.link} src={record.video_link}>
                เปิดวิดีโอ
              </Link>
            </RowFull>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>รายละเอียดปัญหาที่ลูกค้าพบ</Text>
          <Text style={styles.paragraph}>{record.attachment || '-'}</Text>
        </View>

        {hasRca && (
          <View style={[styles.infoTable, { marginBottom: 10 }]}>
            <View style={styles.rcaHeaderRow}>
              <Text style={styles.rcaHeaderText}>สาเหตุและการแก้ไข (RCA)</Text>
            </View>
            {record.cause && <RowFull label="สาเหตุ" value={record.cause} />}
            {record.damaged_parts && <RowFull label="ชิ้นส่วนที่เสียหาย" value={record.damaged_parts} />}
            {record.technician_action && <RowFull label="การดำเนินการของช่าง" value={record.technician_action} />}
            {record.corrective_action && <RowFull label="การแก้ไข (Corrective)" value={record.corrective_action} />}
            {record.preventive_action && <RowFull label="การป้องกัน (Preventive)" value={record.preventive_action} />}
          </View>
        )}

        {PHOTO_CATEGORIES.map((cat) => {
          const photos = (record.photo_links ?? []).filter((p) => p.category === cat.key);
          return (
            <View key={cat.key}>
              <Text style={styles.photoCategoryLabel}>{cat.label}</Text>
              <View style={styles.photoGrid}>
                {photos.length > 0 ? (
                  photos.map((p, i) => {
                    const dataUri = photoDataUris.get(p.url);
                    return (
                      <View key={i} style={styles.photoBox} wrap={false}>
                        {dataUri ? (
                          <Image src={dataUri} style={styles.photo} />
                        ) : (
                          <View style={styles.photoPlaceholder}>
                            <Text style={styles.photoPlaceholderText}>โหลดรูปไม่สำเร็จ</Text>
                          </View>
                        )}
                        <Text style={styles.photoLabel}>{p.label}</Text>
                      </View>
                    );
                  })
                ) : (
                  <View style={styles.photoBox}>
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>ไม่มีรูป</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        <View style={{ marginTop: 10 }}>
          <Text style={styles.auditText}>
            สร้างโดย {record.created_by ?? record.user_name ?? '-'} ·{' '}
            {formatThaiDateTime(record.created_at)}
            {record.updated_by
              ? ` — แก้ไขล่าสุดโดย ${record.updated_by} · ${formatThaiDateTime(record.updated_at)}`
              : ''}
          </Text>
          <Text style={styles.issuedText}>เอกสารออกเมื่อ {formatThaiDateTime(new Date())} โดยระบบ MQR</Text>
        </View>

        <Text style={styles.footer}>{recordUrl}</Text>
      </Page>
    </Document>
  );
}

export async function renderRecordsListPdf(
  records: MqrRecord[],
  title: string,
  baseUrl: string
): Promise<Buffer> {
  ensureFontsRegistered();
  return renderToBuffer(<RecordsListDocument records={records} title={title} />);
}

export async function renderRecordPdf(
  record: MqrRecord,
  baseUrl: string,
  dealerName?: string
): Promise<Buffer> {
  ensureFontsRegistered();
  const recordUrl = `${baseUrl}/records/${encodeURIComponent(record.job_id)}`;
  const [qrDataUrl, photoDataUris] = await Promise.all([
    QRCode.toDataURL(recordUrl, { margin: 0, width: 160 }),
    resolvePhotoDataUris(record),
  ]);
  return renderToBuffer(
    <RecordDocument
      record={record}
      dealerName={dealerName}
      qrDataUrl={qrDataUrl}
      recordUrl={recordUrl}
      photoDataUris={photoDataUris}
    />
  );
}
