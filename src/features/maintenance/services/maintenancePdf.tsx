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
import { resolveImageDataUris, ImageFetchResult } from '@/lib/pdf/fetchImage';
import { resolvePdfAttachmentUrl } from '@/lib/pdf/resolveAttachmentUrl';
import { PdfBrandLogo } from '@/lib/pdf/PdfBrandLogo';
import { PdfHeader } from '@/lib/pdf/PdfHeader';
import { PdfFooter } from '@/lib/pdf/PdfFooter';
import { PDF_LOCALE } from '@/lib/pdf/locale';
import { buildPdfDocumentMeta } from '@/lib/pdf/metadata';
import { sharedPdfStyles } from '@/lib/pdf/sharedStyles';
import { formatDateTimeLocalized, formatDateLocalized } from '@/lib/thaiDate';
import { translate } from '@/lib/i18n/translate';
import { Locale } from '@/lib/i18n/types';
import { AttachmentService } from '@/shared/attachments';
import { MaintenanceRecord, maintenanceAttachmentsOf, MaintenanceAttachmentKind } from '../types';
import { evaluateMaintenanceLock } from '../utils/maintenanceLock';
import { maintenanceImageReferenceToImageItem } from '../utils/maintenanceImageItems';

const ATTACHMENT_I18N_KEY: Record<MaintenanceAttachmentKind, string> = {
  meter: 'photoMeter',
  nameplate: 'photoNameplate',
  report: 'photoReport',
};

const styles = StyleSheet.create({
  ...sharedPdfStyles,
  badge: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, color: '#fff', backgroundColor: '#555' },
  lockedBadge: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, color: '#7a4a00', backgroundColor: '#fde9c8' },

  infoTable: { borderWidth: 1, borderColor: '#ccc', marginTop: 4 },

  section: { marginTop: 10, marginBottom: 4 },

  photoBox: { width: 150, marginBottom: 8, borderWidth: 1, borderColor: '#ddd', padding: 3 },
  // Image Requirements: never crop/stretch/distort - `contain` (not
  // `cover`) letterboxes within the fixed box, same fix as MQR/NTR.
  photo: { width: 142, height: 110, objectFit: 'contain', backgroundColor: '#f3f4f6' },
  photoPlaceholder: { width: 142, height: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' },
  photoPlaceholderText: { fontSize: 7, color: '#aaa', textAlign: 'center', paddingHorizontal: 4 },
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
  photoDataUris: Map<string, ImageFetchResult>;
  locale: Locale;
  generatedBy?: string;
}

function MaintenanceDocument({
  record,
  dealerName,
  intervalLabel,
  qrDataUrl,
  recordUrl,
  photoDataUris,
  locale,
  generatedBy,
}: MaintenanceDocumentProps) {
  const lock = evaluateMaintenanceLock(record);
  const attachments = maintenanceAttachmentsOf(record).map((attachment) => ({
    ...attachment,
    item: maintenanceImageReferenceToImageItem({
      id: `${record.id}-${attachment.kind}`,
      url: attachment.url,
      attachmentId: attachment.attachmentId,
      label: translate(locale, `pdf.${ATTACHMENT_I18N_KEY[attachment.kind]}`),
      category: attachment.kind,
    }),
  }));
  const hasGps = record.latitude !== null && record.longitude !== null;

  return (
    <Document {...buildPdfDocumentMeta(`${record.pm_number ?? record.id} - ${translate(locale, 'pdf.pmTitle')}`, translate(locale, 'pdf.pmTitle'))}>
      <Page size="A4" style={styles.page}>
        <PdfHeader
          title={translate(locale, 'pdf.pmTitle')}
          subtitleLines={[
            `${translate(locale, 'common.pmNumber')} ${record.pm_number ?? record.id} — ${dealerName ?? record.dealer_id}`,
            `${translate(locale, 'pdf.printedAt')} ${formatDateTimeLocalized(new Date(), locale)}`,
          ]}
          badges={[
            <Text key="status" style={styles.badge}>
              {record.status}
            </Text>,
            lock.locked ? (
              <Text key="locked" style={styles.lockedBadge}>
                🔒 {translate(locale, `lockReason.${lock.reason}`)}
              </Text>
            ) : null,
          ]}
          qrDataUrl={qrDataUrl}
          qrCaption={translate(locale, 'pdf.scanToOpen')}
        />

        <View style={styles.infoTable}>
          <Row2 l1={translate(locale, 'csv.model')} v1={record.model} l2={translate(locale, 'pdf.serial')} v2={record.serial} />
          <Row2
            l1={translate(locale, 'common.engineNumber')}
            v1={record.engine_number}
            l2={translate(locale, 'pdf.deliveryDate')}
            v2={record.delivery_date ? formatDateLocalized(record.delivery_date, locale) : null}
          />
          <Row2
            l1={translate(locale, 'pdf.customerName')}
            v1={record.customer_name}
            l2={translate(locale, 'pdf.customerPhone')}
            v2={record.customer_phone}
          />
          <Row2
            l1={translate(locale, 'csv.technicianName')}
            v1={record.technician_name}
            l2={translate(locale, 'common.branch')}
            v2={record.branch_name}
          />
          <Row2
            l1={translate(locale, 'common.performedDate')}
            v1={record.performed_date ? formatDateLocalized(record.performed_date, locale) : null}
            l2={translate(locale, 'pdf.hourMeter')}
            v2={record.hour_meter}
          />
          <Row2
            l1={translate(locale, 'pdf.pmInterval')}
            v1={intervalLabel}
            l2={translate(locale, 'pdf.nextPmDue')}
            v2={record.next_pm_due ? formatDateLocalized(record.next_pm_due, locale) : null}
          />
        </View>

        {record.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{translate(locale, 'common.notes')}</Text>
            <Text style={styles.paragraph}>{record.notes}</Text>
          </View>
        )}

        {hasGps && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{translate(locale, 'pdf.gpsLocation')}</Text>
            <Text style={styles.paragraph}>
              {record.latitude}, {record.longitude}
              {record.gps_accuracy !== null
                ? translate(locale, 'pdf.gpsAccuracySuffix', { m: Math.round(record.gps_accuracy) })
                : ''}
            </Text>
            {record.google_maps_url && <Text style={styles.link}>{record.google_maps_url}</Text>}
          </View>
        )}

        {attachments.map((a) => {
          const result = photoDataUris.get(a.item.displayUrl ?? a.url);
          const label = translate(locale, `pdf.${ATTACHMENT_I18N_KEY[a.kind]}`);
          return (
            <View key={a.kind}>
              <Text style={styles.photoCategoryLabel}>{label}</Text>
              <View style={styles.photoGrid}>
                <View style={styles.photoBox} wrap={false}>
                  {result?.ok ? (
                    <Image src={result.dataUri} style={styles.photo} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>
                        {translate(locale, 'pdf.photoUnavailableWithReason', { reason: result?.reason ?? 'Unknown error' })}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.photoLabel}>{label}</Text>
                </View>
              </View>
            </View>
          );
        })}

        <View style={{ marginTop: 10 }}>
          <Text style={styles.auditText}>
            {translate(locale, 'pdf.createdByAt', { by: record.created_by ?? '-', at: formatDateTimeLocalized(record.created_at, locale) })}
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

function listCols(locale: Locale): { key: string; label: string; width: string; value: (r: MaintenanceRecord) => string }[] {
  return [
    { key: 'pm_number', label: translate(locale, 'csv.pmNumber'), width: '14%', value: (r) => r.pm_number ?? '-' },
    { key: 'dealer_id', label: translate(locale, 'csv.dealer'), width: '9%', value: (r) => r.dealer_id },
    { key: 'performed_date', label: translate(locale, 'csv.performedDate'), width: '9%', value: (r) => r.performed_date ?? '-' },
    { key: 'vehicle', label: translate(locale, 'pdf.colVehicle'), width: '15%', value: (r) => `${r.model ?? '-'} (${r.serial ?? '-'})` },
    { key: 'customer_name', label: translate(locale, 'pdf.colCustomer'), width: '13%', value: (r) => r.customer_name ?? '-' },
    { key: 'technician_name', label: translate(locale, 'csv.technicianName'), width: '13%', value: (r) => r.technician_name ?? '-' },
    { key: 'hour_meter', label: translate(locale, 'pdf.hourMeter'), width: '9%', value: (r) => (r.hour_meter != null ? String(r.hour_meter) : '-') },
    { key: 'status', label: translate(locale, 'common.status'), width: '9%', value: (r) => r.status },
    { key: 'next_pm_due', label: translate(locale, 'pdf.nextPmDue'), width: '9%', value: (r) => r.next_pm_due ?? '-' },
  ];
}

const listStyles = StyleSheet.create({
  page: sharedPdfStyles.page,
  title: sharedPdfStyles.title,
  subtitle: { fontSize: 9, color: '#666', marginBottom: 8 },
  table: { width: '100%', borderWidth: 1, borderColor: '#ddd' },
  rowHeader: { flexDirection: 'row', backgroundColor: '#f3f3f3', borderBottomWidth: 1, borderColor: '#ccc' },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee' },
  cellHeader: { padding: 4, fontWeight: 'bold', fontSize: 8 },
  cell: { padding: 4, fontSize: 8 },
});

function MaintenanceListDocument({ records, title, locale }: { records: MaintenanceRecord[]; title: string; locale: Locale }) {
  const cols = listCols(locale);
  return (
    <Document {...buildPdfDocumentMeta(translate(locale, 'pdf.pmListTitle'), title)}>
      <Page size="A4" orientation="landscape" style={listStyles.page}>
        <PdfBrandLogo />
        <Text style={listStyles.title}>{translate(locale, 'pdf.pmListTitle')}</Text>
        <Text style={listStyles.subtitle}>
          {title} — {translate(locale, 'pdf.printedAt')} {formatDateTimeLocalized(new Date(), locale)} —{' '}
          {translate(locale, 'pdf.quantity')} {records.length} {translate(locale, 'pdf.recordsUnit')}
        </Text>
        <View style={listStyles.table}>
          <View style={listStyles.rowHeader}>
            {cols.map((c) => (
              <Text key={c.key} style={[listStyles.cellHeader, { width: c.width }]}>
                {c.label}
              </Text>
            ))}
          </View>
          {records.map((r) => (
            <View style={listStyles.row} key={r.id} wrap={false}>
              {cols.map((c) => (
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
async function resolveAttachmentDataUris(record: MaintenanceRecord): Promise<Map<string, ImageFetchResult>> {
  const urls = maintenanceAttachmentsOf(record).map((a) => a.url);
  return resolveImageDataUris(urls);
}

/** Defect 1 root cause fix - same as NTR's `resolveNtrPdfRecordUrls`: the
 *  export route never re-resolved the record's own `*_photo_url` columns
 *  (a signed URL with a finite TTL) before rendering, unlike the app's
 *  own PM detail page. Returns a shallow copy with each photo URL
 *  refreshed via its `*_photo_attachment_id`, failing open to the
 *  original URL for a legacy record with no attachment_id. */
async function resolvePmPdfRecordUrls(record: MaintenanceRecord, attachmentService: AttachmentService): Promise<MaintenanceRecord> {
  const [meter, nameplate, report] = await Promise.all([
    resolvePdfAttachmentUrl(attachmentService, record.meter_photo_attachment_id, record.meter_photo_url),
    resolvePdfAttachmentUrl(attachmentService, record.nameplate_photo_attachment_id, record.nameplate_photo_url),
    resolvePdfAttachmentUrl(attachmentService, record.report_photo_attachment_id, record.report_photo_url),
  ]);
  return { ...record, meter_photo_url: meter, nameplate_photo_url: nameplate, report_photo_url: report };
}

export async function renderMaintenanceRecordPdf(
  record: MaintenanceRecord,
  baseUrl: string,
  options?: { dealerName?: string; intervalLabel?: string; generatedBy?: string }
): Promise<Buffer> {
  await ensureFontsRegistered();
  // Corporate PDF Standardization: PDF content is always English, never
  // the viewing user's own UI locale - see PDF_LOCALE's own doc comment.
  const locale = PDF_LOCALE;
  const resolvedRecord = await resolvePmPdfRecordUrls(record, new AttachmentService());
  const recordUrl = `${baseUrl}/pm-records/${encodeURIComponent(record.id)}`;
  const [qrDataUrl, photoDataUris] = await Promise.all([
    QRCode.toDataURL(recordUrl, { margin: 0, width: 160 }),
    resolveAttachmentDataUris(resolvedRecord),
  ]);
  return renderToBuffer(
    <MaintenanceDocument
      record={resolvedRecord}
      dealerName={options?.dealerName}
      intervalLabel={options?.intervalLabel}
      qrDataUrl={qrDataUrl}
      recordUrl={recordUrl}
      photoDataUris={photoDataUris}
      locale={locale}
      generatedBy={options?.generatedBy}
    />
  );
}

export async function renderMaintenanceListPdf(records: MaintenanceRecord[], title: string): Promise<Buffer> {
  await ensureFontsRegistered();
  return renderToBuffer(<MaintenanceListDocument records={records} title={title} locale={PDF_LOCALE} />);
}
