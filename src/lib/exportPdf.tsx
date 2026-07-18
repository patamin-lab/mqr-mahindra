import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Link, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { MqrRecord, Severity, PHOTO_CATEGORIES, PHOTO_CATEGORY_I18N_KEY } from './types';
import { formatDateTimeLocalized } from './thaiDate';
import { PdfBrandLogo } from './pdf/PdfBrandLogo';
import { PdfHeader } from './pdf/PdfHeader';
import { PdfFooter } from './pdf/PdfFooter';
import { ensureFontsRegistered } from './pdf/fonts';
import { fetchImageAsDataUri } from './pdf/fetchImage';
import { PDF_BRAND_RED } from './pdf/brand';
import { sharedPdfStyles } from './pdf/sharedStyles';
import { PDF_LOCALE } from './pdf/locale';
import { buildPdfDocumentMeta } from './pdf/metadata';
import { translate } from './i18n/translate';
import { Locale } from './i18n/types';

/** Resolves every photo URL on a record to a data URI in parallel, keyed by the original URL. */
async function resolvePhotoDataUris(record: MqrRecord): Promise<Map<string, string | null>> {
  const urls = (record.photo_links ?? []).map((p) => p.url);
  const resolved = await Promise.all(urls.map((u) => fetchImageAsDataUri(u)));
  return new Map(urls.map((u, i) => [u, resolved[i]]));
}

const styles = StyleSheet.create({
  ...sharedPdfStyles,
  badge: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, color: '#fff' },

  // Bulk/list export (renderRecordsListPdf) - unchanged from the original
  // table layout, kept separate from the single-record info table below.
  table: { width: '100%', borderWidth: 1, borderColor: '#ddd' },
  rowHeader: { flexDirection: 'row', backgroundColor: '#f3f3f3', borderBottomWidth: 1, borderColor: '#ccc' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
  cellHeader: { padding: 4, fontWeight: 'bold', fontSize: 8 },
  cell: { padding: 4, fontSize: 8 },

  section: { marginTop: 8, marginBottom: 10 },

  // Single-record info table - a bordered grid (label/value pairs, two per
  // row, with long-text fields spanning the full row) modeled after the
  // legacy MSEAL/Tractor-PM report layouts the dealers are used to.
  infoTable: { borderWidth: 1, borderColor: '#ccc' },
  rcaHeaderRow: { backgroundColor: '#fbeaea', padding: 5, borderBottomWidth: 1, borderColor: '#e5c5c5' },
  rcaHeaderText: { fontSize: 9, fontWeight: 'bold', color: PDF_BRAND_RED },

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
});

const SEVERITY_COLORS: Record<Severity, string> = {
  Critical: '#c0392b',
  Major: '#d68910',
  Minor: '#2471a3',
};

function problemSystemLabel(s: string | null, locale: Locale) {
  if (s === 'powertrain') return translate(locale, 'pdf.powertrainSystem');
  if (s) return translate(locale, 'pdf.otherSystem');
  return '-';
}

function listCols(locale: Locale): { key: keyof MqrRecord | 'vehicle'; label: string; width: string }[] {
  return [
    { key: 'job_id', label: translate(locale, 'pdf.colReportNumber'), width: '11%' },
    { key: 'dealer_id', label: translate(locale, 'pdf.colDealer'), width: '8%' },
    { key: 'found_date', label: translate(locale, 'pdf.colFoundDate'), width: '8%' },
    { key: 'vehicle', label: translate(locale, 'pdf.colVehicle'), width: '14%' },
    { key: 'severity', label: translate(locale, 'pdf.colSeverity'), width: '9%' },
    { key: 'customer_name', label: translate(locale, 'pdf.colCustomer'), width: '12%' },
    { key: 'problem_code', label: translate(locale, 'pdf.colProblem'), width: '20%' },
    { key: 'warranty_status', label: translate(locale, 'pdf.colWarranty'), width: '9%' },
    { key: 'status', label: translate(locale, 'pdf.colStatus'), width: '9%' },
  ];
}

function RecordsListDocument({ records, title, locale }: { records: MqrRecord[]; title: string; locale: Locale }) {
  const cols = listCols(locale);
  return (
    <Document {...buildPdfDocumentMeta(translate(locale, 'pdf.mqrTitle'), title)}>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <PdfBrandLogo />
        <Text style={styles.title}>{translate(locale, 'pdf.mqrTitle')}</Text>
        <Text style={styles.subtitle}>
          {title} — {translate(locale, 'pdf.printedAt')} {formatDateTimeLocalized(new Date(), locale)} —{' '}
          {translate(locale, 'pdf.quantity')} {records.length} {translate(locale, 'pdf.jobsUnit')}
        </Text>
        <View style={styles.table}>
          <View style={styles.rowHeader}>
            {cols.map((c) => (
              <Text key={c.key} style={[styles.cellHeader, { width: c.width }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {records.map((r) => (
            <View style={styles.row} key={r.id} wrap={false}>
              <Text style={[styles.cell, { width: cols[0].width }]}>{r.job_id}</Text>
              <Text style={[styles.cell, { width: cols[1].width }]}>{r.dealer_id ?? '-'}</Text>
              <Text style={[styles.cell, { width: cols[2].width }]}>{r.found_date ?? '-'}</Text>
              <Text style={[styles.cell, { width: cols[3].width }]}>
                {r.model ?? '-'} ({r.serial ?? '-'})
              </Text>
              <Text style={[styles.cell, { width: cols[4].width }]}>
                {r.severity ? translate(locale, `severity.${r.severity as Severity}`) : '-'}
              </Text>
              <Text style={[styles.cell, { width: cols[5].width }]}>{r.customer_name ?? '-'}</Text>
              <Text style={[styles.cell, { width: cols[6].width }]}>{r.problem_code ?? '-'}</Text>
              <Text style={[styles.cell, { width: cols[7].width }]}>{r.warranty_status ?? '-'}</Text>
              <Text style={[styles.cell, { width: cols[8].width }]}>{translate(locale, `mqrStatus.${r.status}`)}</Text>
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
  locale,
  generatedBy,
}: {
  record: MqrRecord;
  dealerName?: string;
  qrDataUrl: string;
  recordUrl: string;
  photoDataUris: Map<string, string | null>;
  locale: Locale;
  generatedBy?: string;
}) {
  const statusLabel = translate(locale, `mqrStatus.${record.status}`);
  // Coerced to a real boolean: with `||`, if every RCA field is null/undefined
  // except a trailing empty string (''), `hasRca` would end up as `''` itself
  // - a falsy value, but still a *string*, which React then tries to render
  // as a direct child of the wrapping <View> below and react-pdf logs
  // "Invalid '' string child outside <Text> component" for. Same issue
  // applies to every other `someString && <Component/>` below: when the
  // field is an empty string (not null/undefined), `&&` evaluates to that
  // empty string and JSX renders it as-is instead of skipping it.
  const hasRca = !!(
    record.cause ||
    record.damaged_parts ||
    record.technician_action ||
    record.corrective_action ||
    record.preventive_action
  );

  return (
    <Document {...buildPdfDocumentMeta(`${record.job_id} - ${translate(locale, 'pdf.mqrTitle')}`, translate(locale, 'pdf.mqrTitle'))}>
      <Page size="A4" style={styles.page}>
        <PdfHeader
          title={translate(locale, 'pdf.mqrTitle')}
          subtitleLines={[
            `${translate(locale, 'pdf.reportNumber')} ${record.job_id} — ${dealerName ?? record.dealer_id}`,
            `${translate(locale, 'pdf.printedAt')} ${formatDateTimeLocalized(new Date(), locale)}`,
          ]}
          badges={[
            <Text key="status" style={[styles.badge, { backgroundColor: '#555' }]}>
              {statusLabel}
            </Text>,
            record.severity ? (
              <Text key="severity" style={[styles.badge, { backgroundColor: SEVERITY_COLORS[record.severity as Severity] }]}>
                {translate(locale, `severity.${record.severity}`)}
              </Text>
            ) : null,
          ]}
          qrDataUrl={qrDataUrl}
          qrCaption={translate(locale, 'pdf.scanToOpen')}
        />

        <View style={styles.infoTable}>
          <Row2
            l1={translate(locale, 'pdf.customerName')}
            v1={[record.customer_name, record.customer_phone].filter(Boolean).join(' / ')}
            l2={translate(locale, 'pdf.reporter')}
            v2={[record.reporter_name, record.reporter_phone].filter(Boolean).join(' / ')}
          />
          <Row2 l1={translate(locale, 'csv.model')} v1={record.model} l2={translate(locale, 'pdf.serial')} v2={record.serial} />
          <Row2
            l1={translate(locale, 'pdf.foundDate')}
            v1={record.found_date}
            l2={translate(locale, 'pdf.repairDate')}
            v2={record.repair_date}
          />
          <Row2
            l1={translate(locale, 'pdf.hoursFound')}
            v1={record.hours}
            l2={translate(locale, 'pdf.hoursRepair')}
            v2={record.hours_in_for_repair}
          />
          <Row2
            l1={translate(locale, 'pdf.branchName')}
            v1={record.branch_name}
            l2={translate(locale, 'pdf.technicianName')}
            v2={record.technician_name}
          />
          <Row2
            l1={translate(locale, 'pdf.system')}
            v1={problemSystemLabel(record.problem_system, locale)}
            l2={translate(locale, 'pdf.warrantyStatus')}
            v2={record.warranty_status}
          />
          <RowFull label={translate(locale, 'pdf.problemFound')} value={record.problem_code} />
          {record.peripheral_equipment ? (
            <RowFull label={translate(locale, 'pdf.peripheralEquipment')} value={record.peripheral_equipment} />
          ) : null}
          {record.stock_note ? <RowFull label={translate(locale, 'pdf.stockNote')} value={record.stock_note} /> : null}
          {record.lat !== null && record.lng !== null ? (
            <RowFull label={translate(locale, 'pdf.gpsLocation')}>
              <Link
                style={styles.link}
                src={`https://www.openstreetmap.org/?mlat=${record.lat}&mlon=${record.lng}#map=16/${record.lat}/${record.lng}`}
              >
                {record.lat}, {record.lng} ({translate(locale, 'pdf.openMap')})
              </Link>
            </RowFull>
          ) : null}
          {record.video_link ? (
            <RowFull label={translate(locale, 'pdf.videoLabel')}>
              <Link style={styles.link} src={record.video_link}>
                {translate(locale, 'pdf.openVideo')}
              </Link>
            </RowFull>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{translate(locale, 'pdf.problemDetailSectionTitle')}</Text>
          <Text style={styles.paragraph}>{record.attachment || '-'}</Text>
        </View>

        {hasRca && (
          <View style={[styles.infoTable, { marginBottom: 10 }]}>
            <View style={styles.rcaHeaderRow}>
              <Text style={styles.rcaHeaderText}>{translate(locale, 'pdf.rcaSectionTitle')}</Text>
            </View>
            {record.cause ? <RowFull label={translate(locale, 'pdf.cause')} value={record.cause} /> : null}
            {record.damaged_parts ? (
              <RowFull label={translate(locale, 'pdf.damagedParts')} value={record.damaged_parts} />
            ) : null}
            {record.technician_action ? (
              <RowFull label={translate(locale, 'pdf.technicianAction')} value={record.technician_action} />
            ) : null}
            {record.corrective_action ? (
              <RowFull label={translate(locale, 'pdf.correctiveAction')} value={record.corrective_action} />
            ) : null}
            {record.preventive_action ? (
              <RowFull label={translate(locale, 'pdf.preventiveAction')} value={record.preventive_action} />
            ) : null}
          </View>
        )}

        {PHOTO_CATEGORIES.map((cat) => {
          const photos = (record.photo_links ?? []).filter((p) => p.category === cat.key);
          // Photo sections render only when photos actually exist for that
          // category - an empty box for every one of the (currently 8)
          // PHOTO_CATEGORIES entries, including legacy categories no new
          // record ever populates, wasted page space for no reason.
          if (photos.length === 0) return null;
          const categoryLabel = translate(locale, `pdf.${PHOTO_CATEGORY_I18N_KEY[cat.key] ?? 'photoAfterRepair'}`);
          return (
            <View key={cat.key}>
              <Text style={styles.photoCategoryLabel}>{categoryLabel}</Text>
              <View style={styles.photoGrid}>
                {photos.map((p, i) => {
                  const dataUri = photoDataUris.get(p.url);
                  return (
                    <View key={i} style={styles.photoBox} wrap={false}>
                      {dataUri ? (
                        <Image src={dataUri} style={styles.photo} />
                      ) : (
                        <View style={styles.photoPlaceholder}>
                          <Text style={styles.photoPlaceholderText}>{translate(locale, 'pdf.photoLoadFailed')}</Text>
                        </View>
                      )}
                      <Text style={styles.photoLabel}>{categoryLabel}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={{ marginTop: 10 }}>
          <Text style={styles.auditText}>
            {translate(locale, 'pdf.createdByAt', {
              by: record.created_by ?? record.user_name ?? '-',
              at: formatDateTimeLocalized(record.created_at, locale),
            })}
            {record.updated_by
              ? ` — ${translate(locale, 'pdf.updatedByAt', {
                  by: record.updated_by,
                  at: formatDateTimeLocalized(record.updated_at, locale),
                })}`
              : ''}
          </Text>
        </View>

        <PdfFooter generatedBy={generatedBy} documentUrl={recordUrl} />
      </Page>
    </Document>
  );
}

export async function renderRecordsListPdf(records: MqrRecord[], title: string, baseUrl: string): Promise<Buffer> {
  ensureFontsRegistered();
  return renderToBuffer(<RecordsListDocument records={records} title={title} locale={PDF_LOCALE} />);
}

export async function renderRecordPdf(
  record: MqrRecord,
  baseUrl: string,
  dealerName?: string,
  generatedBy?: string
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
      locale={PDF_LOCALE}
      generatedBy={generatedBy}
    />
  );
}
