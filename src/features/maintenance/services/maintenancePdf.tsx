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
import { sharedPdfStyles } from '@/lib/pdf/sharedStyles';
import { formatDateTimeLocalized } from '@/lib/thaiDate';
import { translate } from '@/lib/i18n/translate';
import { Locale } from '@/lib/i18n/types';
import { MaintenanceRecord, maintenanceAttachmentsOf, MaintenanceAttachmentKind } from '../types';
import { evaluateMaintenanceLock } from '../utils/maintenanceLock';

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
  photo: { width: 142, height: 110, objectFit: 'cover' },
  photoPlaceholder: { width: 142, height: 110, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' },
  photoPlaceholderText: { fontSize: 7, color: '#aaa' },
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
  locale: Locale;
}

function MaintenanceDocument({
  record,
  dealerName,
  intervalLabel,
  qrDataUrl,
  recordUrl,
  photoDataUris,
  locale,
}: MaintenanceDocumentProps) {
  const lock = evaluateMaintenanceLock(record);
  const attachments = maintenanceAttachmentsOf(record);
  const hasGps = record.latitude !== null && record.longitude !== null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <PdfBrandLogo />
            <Text style={styles.title}>{translate(locale, 'pdf.pmTitle')}</Text>
            <Text style={styles.subtitle}>
              {translate(locale, 'common.pmNumber')} {record.pm_number ?? record.id} — {dealerName ?? record.dealer_id}
            </Text>
            <Text style={styles.subtitle}>
              {translate(locale, 'pdf.printedAt')} {formatDateTimeLocalized(new Date(), locale)}
            </Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{record.status}</Text>
              {lock.locked && (
                <Text style={styles.lockedBadge}>🔒 {translate(locale, `lockReason.${lock.reason}`)}</Text>
              )}
            </View>
          </View>
          <View>
            <Image src={qrDataUrl} style={styles.qr} />
            <Text style={styles.qrCaption}>{translate(locale, 'pdf.scanToOpen')}</Text>
          </View>
        </View>
        <View style={styles.titleRule} />

        <View style={styles.infoTable}>
          <Row2 l1={translate(locale, 'csv.model')} v1={record.model} l2={translate(locale, 'pdf.serial')} v2={record.serial} />
          <Row2
            l1={translate(locale, 'common.engineNumber')}
            v1={record.engine_number}
            l2={translate(locale, 'pdf.deliveryDate')}
            v2={record.delivery_date}
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
            v1={record.performed_date}
            l2={translate(locale, 'pdf.hourMeter')}
            v2={record.hour_meter}
          />
          <Row2 l1={translate(locale, 'pdf.pmInterval')} v1={intervalLabel} l2={translate(locale, 'pdf.nextPmDue')} v2={record.next_pm_due} />
          {record.notes && <RowFull label={translate(locale, 'common.notes')} value={record.notes} />}
        </View>

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
          const dataUri = photoDataUris.get(a.url);
          const label = translate(locale, `pdf.${ATTACHMENT_I18N_KEY[a.kind]}`);
          return (
            <View key={a.kind}>
              <Text style={styles.photoCategoryLabel}>{label}</Text>
              <View style={styles.photoGrid}>
                <View style={styles.photoBox} wrap={false}>
                  {dataUri ? (
                    <Image src={dataUri} style={styles.photo} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>{translate(locale, 'pdf.photoLoadFailed')}</Text>
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
          <Text style={styles.issuedText}>
            {translate(locale, 'pdf.issuedBy', { at: formatDateTimeLocalized(new Date(), locale) })} PM
          </Text>
        </View>

        <Text style={styles.footer}>{recordUrl}</Text>
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
    <Document>
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
async function resolveAttachmentDataUris(record: MaintenanceRecord): Promise<Map<string, string | null>> {
  const urls = maintenanceAttachmentsOf(record).map((a) => a.url);
  const resolved = await Promise.all(urls.map((u) => fetchImageAsDataUri(u)));
  return new Map(urls.map((u, i) => [u, resolved[i]]));
}

export async function renderMaintenanceRecordPdf(
  record: MaintenanceRecord,
  baseUrl: string,
  options?: { dealerName?: string; intervalLabel?: string; locale?: Locale }
): Promise<Buffer> {
  ensureFontsRegistered();
  const locale = options?.locale ?? 'th';
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
      locale={locale}
    />
  );
}

export async function renderMaintenanceListPdf(records: MaintenanceRecord[], title: string, locale: Locale = 'th'): Promise<Buffer> {
  ensureFontsRegistered();
  return renderToBuffer(<MaintenanceListDocument records={records} title={title} locale={locale} />);
}
