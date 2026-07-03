/**
 * NTR — PDF export (New Tractor Registration document).
 *
 * Mirrors `lib/exportPdf.tsx` (MQR) and
 * `features/maintenance/services/maintenancePdf.tsx` (PM)'s document
 * structure and reuses the same shared infrastructure (font registration,
 * remote-image resolution, corporate logo slot, brand color,
 * `sharedPdfStyles`) rather than re-implementing any of it.
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { ensureFontsRegistered } from '@/lib/pdf/fonts';
import { fetchImageAsDataUri } from '@/lib/pdf/fetchImage';
import { PdfBrandLogo } from '@/lib/pdf/PdfBrandLogo';
import { sharedPdfStyles } from '@/lib/pdf/sharedStyles';
import { formatDateTimeLocalized, formatDateLocalized } from '@/lib/thaiDate';
import { translate } from '@/lib/i18n/translate';
import { Locale } from '@/lib/i18n/types';
import { NtrRecord } from '../types';

const styles = StyleSheet.create({
  ...sharedPdfStyles,
  badge: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, color: '#fff', backgroundColor: '#555' },
  infoTable: { borderWidth: 1, borderColor: '#ccc', marginTop: 4 },
  section: { marginTop: 10, marginBottom: 4 },
  photoBox: { width: 130, marginBottom: 8, borderWidth: 1, borderColor: '#ddd', padding: 3 },
  photo: { width: 122, height: 96, objectFit: 'cover' },
  photoPlaceholder: { width: 122, height: 96, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fafafa' },
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

interface NtrPhotoEntry {
  key: string;
  label: string;
  url: string | null;
}

function ntrPhotoEntries(record: NtrRecord, locale: Locale): NtrPhotoEntry[] {
  const entries: NtrPhotoEntry[] = [
    { key: 'customer_tractor', label: translate(locale, 'pdf.photoCustomerTractor'), url: record.photo_customer_tractor_url },
    { key: 'serial_plate', label: translate(locale, 'pdf.photoSerialPlate'), url: record.photo_serial_plate_url },
    { key: 'hour_meter', label: translate(locale, 'pdf.photoHourMeterNtr'), url: record.photo_hour_meter_url },
    { key: 'signed_document', label: translate(locale, 'pdf.photoSignedDocument'), url: record.photo_signed_document_url },
  ];
  for (const [i, p] of record.additional_photos.entries()) {
    entries.push({ key: `additional_${i}`, label: p.label, url: p.url });
  }
  return entries.filter((e) => e.url);
}

interface NtrDocumentProps {
  record: NtrRecord;
  dealerName?: string;
  qrDataUrl: string;
  recordUrl: string;
  photoDataUris: Map<string, string | null>;
  locale: Locale;
}

function NtrDocument({ record, dealerName, qrDataUrl, recordUrl, photoDataUris, locale }: NtrDocumentProps) {
  const hasGps = record.latitude !== null && record.longitude !== null;
  const photos = ntrPhotoEntries(record, locale);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <PdfBrandLogo />
            <Text style={styles.title}>{translate(locale, 'pdf.ntrTitle')}</Text>
            <Text style={styles.subtitle}>
              {translate(locale, 'csv.ntrNumber')} {record.ntr_number} — {dealerName ?? record.dealer_id}
            </Text>
            <Text style={styles.subtitle}>
              {translate(locale, 'pdf.printedAt')} {formatDateTimeLocalized(new Date(), locale)}
            </Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{record.status}</Text>
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
            l2={translate(locale, 'csv.retailDate')}
            v2={record.retail_date ? formatDateLocalized(record.retail_date, locale) : null}
          />
          <Row2
            l1={translate(locale, 'pdf.customerName')}
            v1={record.customer_name}
            l2={translate(locale, 'pdf.customerPhone')}
            v2={record.customer_phone}
          />
          <Row2
            l1={translate(locale, 'csv.deliveryDate')}
            v1={formatDateLocalized(record.delivery_date, locale)}
            l2={translate(locale, 'pdf.hourMeter')}
            v2={record.hour_meter}
          />
          <Row2
            l1={translate(locale, 'csv.salesperson')}
            v1={record.salesperson}
            l2={translate(locale, 'csv.receivingPerson')}
            v2={record.receiving_person}
          />
          <Row2 l1={translate(locale, 'csv.customerType')} v1={record.customer_type} l2={translate(locale, 'csv.province')} v2={record.customer_province} />
          {record.customer_address && <RowFull label={translate(locale, 'csv.customerAddress')} value={record.customer_address} />}
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

        {photos.map((p) => {
          const dataUri = p.url ? photoDataUris.get(p.url) : null;
          return (
            <View key={p.key}>
              <Text style={styles.photoCategoryLabel}>{p.label}</Text>
              <View style={styles.photoGrid}>
                <View style={styles.photoBox} wrap={false}>
                  {dataUri ? (
                    <Image src={dataUri} style={styles.photo} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoPlaceholderText}>{translate(locale, 'pdf.photoLoadFailed')}</Text>
                    </View>
                  )}
                  <Text style={styles.photoLabel}>{p.label}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {record.video_url && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{translate(locale, 'pdf.videoLabel')}</Text>
            <Text style={styles.link}>{record.video_url}</Text>
          </View>
        )}

        <View style={{ marginTop: 10 }}>
          <Text style={styles.auditText}>
            {translate(locale, 'pdf.createdByAt', { by: record.created_by, at: formatDateTimeLocalized(record.created_at, locale) })}
            {record.updated_by
              ? ` — ${translate(locale, 'pdf.updatedByAt', {
                  by: record.updated_by,
                  at: formatDateTimeLocalized(record.updated_at, locale),
                })}`
              : ''}
          </Text>
          <Text style={styles.issuedText}>
            {translate(locale, 'pdf.issuedBy', { at: formatDateTimeLocalized(new Date(), locale) })} NTR
          </Text>
        </View>

        <Text style={styles.footer}>{recordUrl}</Text>
      </Page>
    </Document>
  );
}

/** Resolves every photo URL on a record (4 required + additional) to a data
 *  URI in parallel. */
async function resolvePhotoDataUris(record: NtrRecord): Promise<Map<string, string | null>> {
  const urls = ntrPhotoEntries(record, 'th')
    .map((e) => e.url)
    .filter((u): u is string => Boolean(u));
  const resolved = await Promise.all(urls.map((u) => fetchImageAsDataUri(u)));
  return new Map(urls.map((u, i) => [u, resolved[i]]));
}

export async function renderNtrRecordPdf(
  record: NtrRecord,
  baseUrl: string,
  options?: { dealerName?: string; locale?: Locale }
): Promise<Buffer> {
  ensureFontsRegistered();
  const locale = options?.locale ?? 'th';
  const recordUrl = `${baseUrl}/ntr/${encodeURIComponent(record.id)}`;
  const [qrDataUrl, photoDataUris] = await Promise.all([
    QRCode.toDataURL(recordUrl, { margin: 0, width: 160 }),
    resolvePhotoDataUris(record),
  ]);
  return renderToBuffer(
    <NtrDocument
      record={record}
      dealerName={options?.dealerName}
      qrDataUrl={qrDataUrl}
      recordUrl={recordUrl}
      photoDataUris={photoDataUris}
      locale={locale}
    />
  );
}
