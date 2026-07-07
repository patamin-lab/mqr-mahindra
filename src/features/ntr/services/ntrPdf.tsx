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
import { fetchImageAsDataUri } from '@/lib/pdf/fetchImage';
import { PdfBrandLogo } from '@/lib/pdf/PdfBrandLogo';
import { sharedPdfStyles } from '@/lib/pdf/sharedStyles';
import { formatDateTimeLocalized, formatDateLocalized } from '@/lib/thaiDate';
import { calcWarranty } from '@/lib/warranty';
import { translate } from '@/lib/i18n/translate';
import { Locale } from '@/lib/i18n/types';
import { NtrRecord, NtrAttachmentType } from '../types';
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
}

function ntrAttachmentEntries(record: NtrRecord, locale: Locale): NtrAttachmentEntry[] {
  const label = (type: NtrAttachmentType) => translate(locale, `ntr.attachmentType_${type}`);
  const fixed: NtrAttachmentEntry[] = [
    record.photo_customer_id_url && { url: record.photo_customer_id_url, type: 'CUSTOMER_ID' as const, label: label('CUSTOMER_ID') },
    record.photo_customer_tractor_url && { url: record.photo_customer_tractor_url, type: 'CUSTOMER_TRACTOR' as const, label: label('CUSTOMER_TRACTOR') },
    record.photo_serial_plate_url && { url: record.photo_serial_plate_url, type: 'SERIAL_PLATE' as const, label: label('SERIAL_PLATE') },
    record.photo_hour_meter_url && { url: record.photo_hour_meter_url, type: 'HOUR_METER' as const, label: label('HOUR_METER') },
    record.photo_signed_document_url && { url: record.photo_signed_document_url, type: 'DELIVERY_SHEET' as const, label: label('DELIVERY_SHEET') },
  ].filter(Boolean) as NtrAttachmentEntry[];
  const additional: NtrAttachmentEntry[] = record.additional_photos.map((p) => ({ url: p.url, type: p.type ?? 'OTHER', label: p.label }));
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
  photoDataUris: Map<string, string | null>;
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
  const warranty = calcWarranty(record.retail_date, new Date().toISOString().slice(0, 10), 'other');
  const fullCustomerName =
    record.customer_first_name || record.customer_last_name
      ? [record.customer_title, record.customer_first_name, record.customer_last_name].filter(Boolean).join(' ')
      : record.customer_name;

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <PdfBrandLogo />
            <Text style={styles.title}>{translate(locale, 'pdf.ntrTitle')}</Text>
            <Text style={styles.subtitle}>{translate(locale, 'ntr.registerTitle')}</Text>
            <Text style={styles.subtitle}>
              {translate(locale, 'csv.ntrNumber')} {record.ntr_number} — {dealerName ?? record.dealer_id}
              {branchName ? ` / ${branchName}` : ''}
            </Text>
            <Text style={styles.subtitle}>
              {translate(locale, 'ntr.registrationDate')}: {formatDateTimeLocalized(record.created_at, locale)}
            </Text>
            <View style={styles.badgeRow}>
              <Text style={styles.badge}>{record.status}</Text>
            </View>
          </View>
          <View>
            <Image src={qrDataUrl} style={styles.qr} />
            <Text style={styles.qrCaption}>{translate(locale, 'ntr.qrScanCaption')}</Text>
          </View>
        </View>
        <View style={styles.titleRule} />

        {/* Section 1: Registration Information */}
        <Text style={styles.sectionTitle}>{translate(locale, 'ntr.registrationInfoTitle')}</Text>
        <View style={styles.infoTable}>
          <Row2 l1={translate(locale, 'csv.ntrNumber')} v1={record.ntr_number} l2={translate(locale, 'common.dealer')} v2={dealerName ?? record.dealer_id} />
          <Row2 l1={translate(locale, 'common.branch')} v1={branchName} l2={translate(locale, 'ntr.registrationDate')} v2={formatDateLocalized(record.created_at, locale)} />
          <Row2
            l1={translate(locale, 'csv.retailDate')}
            v1={record.retail_date ? formatDateLocalized(record.retail_date, locale) : null}
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
              <RowFull label={translate(locale, 'ntr.acceptanceDate')} value={formatDateLocalized(record.delivery_date, locale)} />
            </View>
          </>
        )}

        {/* Section 5: Attachments - responsive 2-column gallery, hidden entirely when nothing to show */}
        {attachments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{translate(locale, 'ntr.photosTitle')}</Text>
            <View style={styles.photoGrid2col}>
              {attachments.map((a, i) => {
                const dataUri = photoDataUris.get(a.url);
                return (
                  <View key={`${a.type}-${i}`} style={styles.photoBox2col} wrap={false}>
                    {dataUri ? (
                      <Image src={dataUri} style={styles.photo2col} />
                    ) : (
                      <View style={styles.photoPlaceholder2col}>
                        <Text style={styles.photoPlaceholderText}>{translate(locale, 'pdf.photoLoadFailed')}</Text>
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
                <Text style={styles.statusTileLabel}>{translate(locale, 'csv.retailDate')}</Text>
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
        <View style={{ marginTop: 10 }}>
          <Text style={styles.auditText}>
            {translate(locale, 'ntr.footerAppName')} — {translate(locale, 'ntr.footerGeneratedAt')}: {formatDateTimeLocalized(new Date(), locale)}
            {' — '}
            {translate(locale, 'ntr.footerGeneratedBy')}: {generatedBy}
            {' — '}
            {translate(locale, 'ntr.footerSystemVersion')}: MASP v1.1
          </Text>
        </View>

        <Text style={styles.footer}>{tractorProfileUrl}</Text>
      </Page>
    </Document>
  );
}

/** Resolves every attachment URL (4 fixed + additional) to a data URI in
 *  parallel. */
async function resolvePhotoDataUris(record: NtrRecord, locale: Locale): Promise<Map<string, string | null>> {
  const urls = ntrAttachmentEntries(record, locale).map((e) => e.url);
  const resolved = await Promise.all(urls.map((u) => fetchImageAsDataUri(u)));
  return new Map(urls.map((u, i) => [u, resolved[i]]));
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
    locale?: Locale;
  }
): Promise<Buffer> {
  ensureFontsRegistered();
  const locale = options?.locale ?? 'th';
  // Per spec: the QR opens the Tractor Profile, not this PDF/record.
  const tractorProfileUrl = `${baseUrl}/vehicles/${encodeURIComponent(record.serial)}`;
  const [qrDataUrl, photoDataUris] = await Promise.all([
    QRCode.toDataURL(tractorProfileUrl, { margin: 0, width: 160 }),
    resolvePhotoDataUris(record, locale),
  ]);
  return renderToBuffer(
    <NtrDocument
      record={record}
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
