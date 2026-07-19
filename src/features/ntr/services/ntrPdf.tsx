/**
 * NTR — Enterprise Delivery Record PDF.
 *
 * Redesigned per the MASP v1.1 "NTR Enterprise PDF & Tractor Delivery
 * Record" sprint - same 7-section structure as the Detail Page
 * (`app/(app)/ntr/[id]/page.tsx`), reusing `sharedPdfStyles` (the same
 * shared theme MQR/PM already use), the standardized attachment-type
 * taxonomy (`NTR_ATTACHMENT_TYPES`), and hide-if-empty for every section/
 * row with no data - never an "N/A" placeholder for a field this module
 * doesn't capture.
 *
 * The QR code encodes the Tractor Profile URL (`/vehicles/<serial>`), not
 * a link back to this PDF/record - per spec, "QR must open Tractor
 * Profile, NOT the PDF."
 */
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer';
import QRCode from 'qrcode';
import { ensureFontsRegistered } from '@/lib/pdf/fonts';
import { resolveImageDataUris, ImageFetchResult } from '@/lib/pdf/fetchImage';
import { sharedPdfStyles } from '@/lib/pdf/sharedStyles';
import { PdfHeader } from '@/lib/pdf/PdfHeader';
import { PdfFooter } from '@/lib/pdf/PdfFooter';
import { PDF_LOCALE } from '@/lib/pdf/locale';
import { buildPdfDocumentMeta } from '@/lib/pdf/metadata';
import { formatDateTimeLocalized, formatDateLocalized } from '@/lib/thaiDate';
import { calcWarranty } from '@/lib/warranty';
import { translate } from '@/lib/i18n/translate';
import { Locale } from '@/lib/i18n/types';
import { AttachmentService } from '@/shared/attachments';
import { resolvePdfAttachmentUrl } from '@/lib/pdf/resolveAttachmentUrl';
import { NtrRecord, NtrAttachmentType } from '../types';
import { ntrImageReferenceToImageItem } from '../utils/ntrImageItems';
import type { ImageItem } from '@/components/shared/image';
import type { VehicleEvent as PlatformVehicleEvent, VehicleSummary } from '@/features/vehicle/types';

const styles = StyleSheet.create({
  ...sharedPdfStyles,
  badge: { fontSize: 8, paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, color: '#fff', backgroundColor: '#555' },
  infoTable: { borderWidth: 1, borderColor: '#ccc', marginTop: 4 },
  section: { marginTop: 10, marginBottom: 4 },
  photoBox2col: { width: '48%', marginBottom: 8, borderWidth: 1, borderColor: '#ddd', padding: 3 },
  photoGrid2col: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  // Fixed 16:9 frame (matches the on-screen preview/gallery convention) -
  // objectFit 'contain' so a photo is never cropped or stretched; the
  // light gray background letterboxes anything not natively 16:9.
  photo2col: { width: '100%', aspectRatio: 16 / 9, objectFit: 'contain', backgroundColor: '#f3f4f6' },
  photoPlaceholder2col: { width: '100%', aspectRatio: 16 / 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3f4f6' },
  photoPlaceholderText: { fontSize: 7, color: '#aaa' },
  timelineRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#eee', paddingVertical: 3 },
  timelineDate: { width: '18%', fontSize: 8, color: '#666' },
  timelineDesc: { width: '82%', fontSize: 8.5 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  statusTile: { width: '31%', borderWidth: 1, borderColor: '#eee', borderRadius: 3, padding: 6 },
  statusTileLabel: { fontSize: 7, color: '#888', marginBottom: 2 },
  statusTileValue: { fontSize: 9.5, fontWeight: 'bold', color: '#1a1a1a' },
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

/** Every row is included only when it has a real value - no section shows
 *  an "N/A"/empty placeholder for a field this module doesn't capture
 *  (e.g. Engine Model, Delivery Location, Remark - no data source today). */
function OptionalRow2({ l1, v1, l2, v2 }: { l1: string; v1?: string | number | null; l2: string; v2?: string | number | null }) {
  if (v1 == null && v2 == null) return null;
  return <Row2 l1={l1} v1={v1} l2={l2} v2={v2} />;
}

interface NtrAttachmentEntry {
  url: string;
  type: NtrAttachmentType;
  label: string;
  item: ImageItem;
}

function ntrAttachmentEntries(record: NtrRecord, locale: Locale): NtrAttachmentEntry[] {
  const label = (type: NtrAttachmentType) => translate(locale, `ntr.attachmentType_${type}`);
  const entry = (id: string, url: string, attachmentId: string | null, type: NtrAttachmentType, itemLabel: string): NtrAttachmentEntry => {
    const item = ntrImageReferenceToImageItem({ id, url, attachmentId, label: itemLabel, category: type });
    return { url, type, label: itemLabel, item };
  };
  const fixed: NtrAttachmentEntry[] = [
    record.photo_customer_id_url && entry(`${record.id}-customer-id`, record.photo_customer_id_url, record.photo_customer_id_attachment_id, 'CUSTOMER_ID', label('CUSTOMER_ID')),
    record.photo_customer_tractor_url && entry(`${record.id}-customer-tractor`, record.photo_customer_tractor_url, record.photo_customer_tractor_attachment_id, 'CUSTOMER_TRACTOR', label('CUSTOMER_TRACTOR')),
    record.photo_serial_plate_url && entry(`${record.id}-serial-plate`, record.photo_serial_plate_url, record.photo_serial_plate_attachment_id, 'SERIAL_PLATE', label('SERIAL_PLATE')),
    record.photo_hour_meter_url && entry(`${record.id}-hour-meter`, record.photo_hour_meter_url, record.photo_hour_meter_attachment_id, 'HOUR_METER', label('HOUR_METER')),
    record.photo_signed_document_url && entry(`${record.id}-delivery-sheet`, record.photo_signed_document_url, record.photo_signed_document_attachment_id, 'DELIVERY_SHEET', label('DELIVERY_SHEET')),
  ].filter(Boolean) as NtrAttachmentEntry[];
  const additional: NtrAttachmentEntry[] = record.additional_photos.map((p, index) => entry(`${record.id}-additional-${index}`, p.url, p.attachmentId ?? null, p.type ?? 'OTHER', p.label));
  return [...fixed, ...additional];
}

function sourceLabel(source: NtrRecord['source'], locale: Locale): string {
  if (source === 'legacy_import') return translate(locale, 'ntr.sourceLegacyImport');
  if (source === 'api') return translate(locale, 'ntr.sourceApi');
  return translate(locale, 'ntr.sourceManual');
}

interface NtrDocumentProps {
  record: NtrRecord;
  dealerName?: string;
  branchName?: string | null;
  productFamilyName?: string | null;
  qrDataUrl: string;
  tractorProfileUrl: string;
  photoDataUris: Map<string, ImageFetchResult>;
  summary: VehicleSummary | null;
  timeline: PlatformVehicleEvent[];
  locale: Locale;
  generatedBy: string;
}

function NtrDocument({
  record,
  dealerName,
  branchName,
  productFamilyName,
  qrDataUrl,
  tractorProfileUrl,
  photoDataUris,
  summary,
  timeline,
  locale,
  generatedBy,
}: NtrDocumentProps) {
  const hasGps = record.latitude !== null && record.longitude !== null;
  const attachments = ntrAttachmentEntries(record, locale);
  // Warranty Start must always equal Customer Delivery Date, never an
  // independently-tracked date (`retail_date` is a legacy/import-only
  // field, null for every record created via the current manual NTR
  // form - see docs/architecture/BUSINESS_INVARIANTS.md's "Warranty Start
  // = Delivery Date" verdict).
  const warranty = calcWarranty(record.delivery_date, new Date().toISOString().slice(0, 10), 'other');
  const fullCustomerName =
    record.customer_first_name || record.customer_last_name
      ? [record.customer_title, record.customer_first_name, record.customer_last_name].filter(Boolean).join(' ')
      : record.customer_name;

  return (
    <Document {...buildPdfDocumentMeta(`${record.ntr_number} - ${translate(locale, 'pdf.ntrTitle')}`, translate(locale, 'ntr.registerTitle'))}>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <PdfHeader
          title={translate(locale, 'pdf.ntrTitle')}
          subtitleLines={[
            translate(locale, 'ntr.registerTitle'),
            `${translate(locale, 'csv.ntrNumber')} ${record.ntr_number} — ${dealerName ?? record.dealer_id}${branchName ? ` / ${branchName}` : ''}`,
            `${translate(locale, 'ntr.documentSubmissionDate')}: ${formatDateTimeLocalized(record.created_at, locale)}`,
          ]}
          badges={[
            <Text key="status" style={styles.badge}>
              {record.status}
            </Text>,
          ]}
          qrDataUrl={qrDataUrl}
          qrCaption={translate(locale, 'ntr.qrScanCaption')}
        />

        {/* Section 1: Registration Information */}
        <Text style={styles.sectionTitle}>{translate(locale, 'ntr.registrationInfoTitle')}</Text>
        <View style={styles.infoTable}>
          <Row2 l1={translate(locale, 'csv.ntrNumber')} v1={record.ntr_number} l2={translate(locale, 'common.dealer')} v2={dealerName ?? record.dealer_id} />
          <Row2 l1={translate(locale, 'common.branch')} v1={branchName} l2={translate(locale, 'ntr.documentSubmissionDate')} v2={formatDateLocalized(record.created_at, locale)} />
          <Row2
            l1={translate(locale, 'csv.deliveryDate')}
            v1={formatDateLocalized(record.delivery_date, locale)}
            l2={translate(locale, 'csv.pdiDate')}
            v2={record.pdi_date ? formatDateLocalized(record.pdi_date, locale) : null}
          />
          <Row2
            l1={translate(locale, 'pdf.hourMeter')}
            v1={record.hour_meter}
            l2={translate(locale, 'csv.salesperson')}
            v2={record.salesperson}
          />
          <RowFull label={translate(locale, 'ntr.registrationSource')} value={sourceLabel(record.source, locale)} />
        </View>

        {/* Section 2: Tractor Information */}
        <Text style={styles.sectionTitle}>{translate(locale, 'ntr.tractorInfoTitle')}</Text>
        <View style={styles.infoTable}>
          <Row2 l1={translate(locale, 'common.productFamily')} v1={productFamilyName} l2={translate(locale, 'csv.model')} v2={record.model} />
          <OptionalRow2 l1={translate(locale, 'csv.variant')} v1={record.variant} l2={translate(locale, 'csv.manufacturingYear')} v2={record.manufacturing_year} />
          <Row2 l1={translate(locale, 'csv.serial')} v1={record.serial} l2={translate(locale, 'common.engineNumber')} v2={record.engine_number} />
          {/* Tractor Lifecycle foundation (MASP v1.1) - always shown
              ("Hide nothing"); this record's own existence guarantees an
              NTR is on file, so 'Delivered' is a safe fallback even if
              summary itself is unexpectedly absent. */}
          <Row2
            l1={translate(locale, 'csv.warrantyStatus')}
            v1={warranty.status}
            l2={translate(locale, 'csv.currentLifecycle')}
            v2={translate(locale, `lifecycleStatus.${summary?.lifecycleStatus ?? 'Delivered'}`)}
          />
        </View>

        {/* Section 3: Customer Information */}
        <Text style={styles.sectionTitle}>{translate(locale, 'ntr.customerInfoTitle')}</Text>
        <View style={styles.infoTable}>
          <Row2 l1={translate(locale, 'pdf.customerName')} v1={fullCustomerName} l2={translate(locale, 'pdf.customerPhone')} v2={record.customer_phone} />
          {record.customer_address && <RowFull label={translate(locale, 'csv.customerAddress')} value={record.customer_address} />}
          <OptionalRow2 l1={translate(locale, 'csv.subdistrict')} v1={record.customer_subdistrict} l2={translate(locale, 'csv.district')} v2={record.customer_district} />
          <OptionalRow2 l1={translate(locale, 'csv.province')} v1={record.customer_province} l2={translate(locale, 'csv.postalCode')} v2={record.customer_postal_code} />
          {hasGps && (
            <RowFull
              label={translate(locale, 'pdf.gpsLocation')}
              value={`${record.latitude}, ${record.longitude}${record.google_maps_url ? ` — ${record.google_maps_url}` : ''}`}
            />
          )}
        </View>

        {/* Section 4: Delivery Information */}
        {(record.salesperson || record.receiving_person) && (
          <>
            <Text style={styles.sectionTitle}>{translate(locale, 'ntr.deliveryInfoTitle')}</Text>
            <View style={styles.infoTable}>
              <Row2
                l1={translate(locale, 'ntr.dealerRepresentative')}
                v1={record.salesperson}
                l2={translate(locale, 'ntr.customerRepresentative')}
                v2={record.receiving_person}
              />
            </View>
          </>
        )}

        {/* Section 5: Attachments - responsive 2-column gallery, hidden entirely when nothing to show */}
        {attachments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{translate(locale, 'ntr.photosTitle')}</Text>
            <View style={styles.photoGrid2col}>
              {attachments.map((a, i) => {
                const result = photoDataUris.get(a.url);
                return (
                  <View key={`${a.type}-${i}`} style={styles.photoBox2col} wrap={false}>
                    {result?.ok ? (
                      <Image src={result.dataUri} style={styles.photo2col} />
                    ) : (
                      <View style={styles.photoPlaceholder2col}>
                        <Text style={styles.photoPlaceholderText}>
                          {translate(locale, 'pdf.photoUnavailableWithReason', { reason: result?.reason ?? 'Unknown error' })}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.photoLabel}>{a.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Section 6: Tractor Timeline - newest first, reuses the Platform Timeline */}
        {timeline.length > 0 && (
          <View style={styles.section} break={attachments.length > 4}>
            <Text style={styles.sectionTitle}>{translate(locale, 'ntr.timelineSectionTitle')}</Text>
            {timeline.slice(0, 15).map((ev, i) => (
              <View key={i} style={styles.timelineRow} wrap={false}>
                <Text style={styles.timelineDate}>{formatDateLocalized(ev.date, locale)}</Text>
                <Text style={styles.timelineDesc}>
                  {translate(locale, `vehicleEventType.${ev.type}`)} — {ev.description}
                  {ev.referenceNumber ? ` (${ev.referenceNumber})` : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Section 7: Current Tractor Status */}
        {summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{translate(locale, 'ntr.currentStatusSectionTitle')}</Text>
            <View style={styles.statusGrid}>
              <View style={styles.statusTile}>
                <Text style={styles.statusTileLabel}>{translate(locale, 'ntr.currentOwner')}</Text>
                <Text style={styles.statusTileValue}>{fmt(summary.ownerName)}</Text>
              </View>
              <View style={styles.statusTile}>
                <Text style={styles.statusTileLabel}>{translate(locale, 'common.dealer')}</Text>
                <Text style={styles.statusTileValue}>{fmt(summary.dealerName)}</Text>
              </View>
              <View style={styles.statusTile}>
                <Text style={styles.statusTileLabel}>{translate(locale, 'csv.deliveryDate')}</Text>
                <Text style={styles.statusTileValue}>{summary.retailDate ? formatDateLocalized(summary.retailDate, locale) : '-'}</Text>
              </View>
              <View style={styles.statusTile}>
                <Text style={styles.statusTileLabel}>{translate(locale, 'csv.warrantyStatus')}</Text>
                <Text style={styles.statusTileValue}>{warranty.status}</Text>
              </View>
              <View style={styles.statusTile}>
                <Text style={styles.statusTileLabel}>{translate(locale, 'common.healthScore')}</Text>
                <Text style={styles.statusTileValue}>{summary.healthScore}</Text>
              </View>
              <View style={styles.statusTile}>
                <Text style={styles.statusTileLabel}>{translate(locale, 'common.compliance')}</Text>
                <Text style={styles.statusTileValue}>{summary.compliancePercent != null ? `${summary.compliancePercent}%` : '-'}</Text>
              </View>
              <View style={styles.statusTile}>
                <Text style={styles.statusTileLabel}>{translate(locale, 'vehicle360.lastMaintenanceDate')}</Text>
                <Text style={styles.statusTileValue}>{summary.lastMaintenanceDate ? formatDateLocalized(summary.lastMaintenanceDate, locale) : '-'}</Text>
              </View>
              <View style={styles.statusTile}>
                <Text style={styles.statusTileLabel}>{translate(locale, 'vehicle360.openMqrLabel')}</Text>
                <Text style={styles.statusTileValue}>{summary.openMqrCount}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <PdfFooter generatedBy={generatedBy} documentUrl={tractorProfileUrl} />
      </Page>
    </Document>
  );
}

/** Resolves every attachment URL (4 fixed + additional) to a data URI in
 *  parallel. */
async function resolvePhotoDataUris(record: NtrRecord, locale: Locale): Promise<Map<string, ImageFetchResult>> {
  const urls = ntrAttachmentEntries(record, locale)
    .map((e) => e.item.displayUrl)
    .filter((url): url is string => Boolean(url));
  return resolveImageDataUris(urls);
}

/** Defect 1 root cause fix: `record`'s own `photo_*_url`/`additional_photos[].url`
 *  columns are whatever signed URL was current at upload time - the export
 *  route never re-resolved them (unlike the app's own NTR detail page),
 *  so any photo older than the signed-URL TTL 403'd and silently vanished
 *  from the PDF. Returns a shallow copy with every URL refreshed via its
 *  `attachmentId`, failing open to the original URL for a legacy record
 *  with no attachment_id at all. */
async function resolveNtrPdfRecordUrls(record: NtrRecord, attachmentService: AttachmentService): Promise<NtrRecord> {
  const [customerId, customerTractor, serialPlate, hourMeter, signedDocument, additionalPhotos] = await Promise.all([
    resolvePdfAttachmentUrl(attachmentService, record.photo_customer_id_attachment_id, record.photo_customer_id_url),
    resolvePdfAttachmentUrl(attachmentService, record.photo_customer_tractor_attachment_id, record.photo_customer_tractor_url),
    resolvePdfAttachmentUrl(attachmentService, record.photo_serial_plate_attachment_id, record.photo_serial_plate_url),
    resolvePdfAttachmentUrl(attachmentService, record.photo_hour_meter_attachment_id, record.photo_hour_meter_url),
    resolvePdfAttachmentUrl(attachmentService, record.photo_signed_document_attachment_id, record.photo_signed_document_url),
    Promise.all(
      record.additional_photos.map(async (p) => ({ ...p, url: (await resolvePdfAttachmentUrl(attachmentService, p.attachmentId, p.url)) ?? p.url }))
    ),
  ]);
  return {
    ...record,
    photo_customer_id_url: customerId,
    photo_customer_tractor_url: customerTractor,
    photo_serial_plate_url: serialPlate,
    photo_hour_meter_url: hourMeter,
    photo_signed_document_url: signedDocument,
    additional_photos: additionalPhotos,
  };
}

export async function renderNtrRecordPdf(
  record: NtrRecord,
  baseUrl: string,
  options?: {
    dealerName?: string;
    branchName?: string | null;
    productFamilyName?: string | null;
    summary?: VehicleSummary | null;
    timeline?: PlatformVehicleEvent[];
    generatedBy?: string;
  }
): Promise<Buffer> {
  await ensureFontsRegistered();
  // Corporate PDF Standardization: PDF content is always English, never
  // the viewing user's own UI locale - see PDF_LOCALE's own doc comment.
  const locale = PDF_LOCALE;
  const resolvedRecord = await resolveNtrPdfRecordUrls(record, new AttachmentService());
  // Per spec: the QR opens the Tractor Profile, not this PDF/record.
  const tractorProfileUrl = `${baseUrl}/vehicles/${encodeURIComponent(record.serial)}`;
  const [qrDataUrl, photoDataUris] = await Promise.all([
    QRCode.toDataURL(tractorProfileUrl, { margin: 0, width: 160 }),
    resolvePhotoDataUris(resolvedRecord, locale),
  ]);
  return renderToBuffer(
    <NtrDocument
      record={resolvedRecord}
      dealerName={options?.dealerName}
      branchName={options?.branchName}
      productFamilyName={options?.productFamilyName}
      qrDataUrl={qrDataUrl}
      tractorProfileUrl={tractorProfileUrl}
      photoDataUris={photoDataUris}
      summary={options?.summary ?? null}
      timeline={options?.timeline ?? []}
      locale={locale}
      generatedBy={options?.generatedBy ?? '-'}
    />
  );
}
