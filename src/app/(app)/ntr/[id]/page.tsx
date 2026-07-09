import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { canDelete } from '@/lib/scope';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import { MasterDataService } from '@/shared/master-data';
import { getVehicleSummary, getVehicleTimeline } from '@/features/vehicle/service';
import { formatDateTimeLocalized, formatDateLocalized } from '@/lib/thaiDate';
import { calcWarranty } from '@/lib/warranty';
import { createNtrService } from '@/features/ntr/factory';
import NtrDeleteButton from './delete-button';
import NtrPrintButton from './print-button';
import { t, getServerLocale } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import StatusPill from '@/components/shared/status/StatusPill';
import AttachmentGallery, { AttachmentGalleryItem } from '@/components/shared/attachments/AttachmentGallery';
import DetailRow from '@/components/shared/layout/DetailRow';
import Timeline from '@/components/shared/timeline/Timeline';
import TimelineItem from '@/components/shared/timeline/TimelineItem';
import type { NtrAttachmentType } from '@/features/ntr/types';
import type { VehicleEvent } from '@/features/vehicle/types';

interface RouteParams {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

function sourceLabel(source: string): string {
  if (source === 'legacy_import') return t('ntr.sourceLegacyImport');
  if (source === 'api') return t('ntr.sourceApi');
  return t('ntr.sourceManual');
}

function TimelineRow({ event }: { event: VehicleEvent }) {
  return (
    <TimelineItem
      liClassName="rounded border border-gray-100 p-3 hover:bg-gray-50"
      href={event.href}
      date={event.date}
      badge={t(`vehicleEventType.${event.type}`)}
      leadingExtra={<span className="text-xs text-brand-red">{event.referenceNumber}</span>}
      trailing={event.status && <span className="text-xs text-gray-500">{event.status}</span>}
    >
      <p className="mt-1 text-sm text-gray-800">{event.description}</p>
    </TimelineItem>
  );
}

export default async function NtrDetailPage({ params }: RouteParams) {
  const session = await getSession();
  if (!session) return null;
  const locale = getServerLocale();

  const record = await createNtrService().getById(params.id, session);

  if (!record) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('ntr.detailTitle')}
          subtitle={t('ntr.recordIdLabel', { id: params.id })}
          actions={
            <Link href="/ntr" className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark">
              {t('common.backToList')}
            </Link>
          }
        />
        <div className="rounded border border-yellow-200 bg-yellow-50 p-6 text-yellow-800">
          <p>{t('ntr.notFound')}</p>
        </div>
      </div>
    );
  }

  // Dealer/Branch Scope Platform Standard: a non-privileged actor may only
  // view their own dealer's/branch's record - not just dealer-level.
  if (!canAccessDealerBranch(session, record.dealer_id, record.branch_id)) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('ntr.detailTitle')} />
        <div className="rounded border border-red-200 bg-red-50 p-6 text-red-700">
          <p>{t('validation.unauthorizedRecordAccess')}</p>
        </div>
      </div>
    );
  }

  const allowDelete = canDelete(session.role);

  const [branch, productFamily, summary, timeline] = await Promise.all([
    record.branch_id ? MasterDataService.getBranch(record.branch_id) : Promise.resolve(null),
    record.product_family_id ? MasterDataService.getProductFamilyById(record.product_family_id) : Promise.resolve(null),
    getVehicleSummary(record.serial, session),
    getVehicleTimeline(record.serial, session),
  ]);

  const warranty = calcWarranty(record.retail_date, new Date().toISOString().slice(0, 10), 'other');
  const fullCustomerName =
    record.customer_first_name || record.customer_last_name
      ? [record.customer_title, record.customer_first_name, record.customer_last_name].filter(Boolean).join(' ')
      : record.customer_name;

  // Standardized attachment taxonomy (docs/standards/DOMAIN_LANGUAGE_STANDARD.md) -
  // hide any card with no uploaded file, never show an empty placeholder.
  const attachments: (AttachmentGalleryItem & { type: NtrAttachmentType })[] = [
    record.photo_customer_id_url && {
      key: 'customer_id', type: 'CUSTOMER_ID' as const, url: record.photo_customer_id_url,
      alt: t('ntr.attachmentType_CUSTOMER_ID'), caption: t('ntr.attachmentType_CUSTOMER_ID'),
    },
    record.photo_customer_tractor_url && {
      key: 'customer_tractor', type: 'CUSTOMER_TRACTOR' as const, url: record.photo_customer_tractor_url,
      alt: t('ntr.attachmentType_CUSTOMER_TRACTOR'), caption: t('ntr.attachmentType_CUSTOMER_TRACTOR'),
    },
    record.photo_serial_plate_url && {
      key: 'serial_plate', type: 'SERIAL_PLATE' as const, url: record.photo_serial_plate_url,
      alt: t('ntr.attachmentType_SERIAL_PLATE'), caption: t('ntr.attachmentType_SERIAL_PLATE'),
    },
    record.photo_hour_meter_url && {
      key: 'hour_meter', type: 'HOUR_METER' as const, url: record.photo_hour_meter_url,
      alt: t('ntr.attachmentType_HOUR_METER'), caption: t('ntr.attachmentType_HOUR_METER'),
    },
    record.photo_signed_document_url && {
      key: 'signed_document', type: 'DELIVERY_SHEET' as const, url: record.photo_signed_document_url,
      alt: t('ntr.attachmentType_DELIVERY_SHEET'), caption: t('ntr.attachmentType_DELIVERY_SHEET'),
    },
    ...record.additional_photos.map((p, i) => ({
      key: `additional_${i}`, type: (p.type ?? 'OTHER') as NtrAttachmentType, url: p.url, alt: p.label, caption: p.label,
    })),
  ].filter(Boolean) as (AttachmentGalleryItem & { type: NtrAttachmentType })[];

  return (
    <div className="space-y-4 print:space-y-2">
      <PageHeader
        title={t('ntr.detailTitle')}
        titleAdornments={<StatusPill colorClassName="bg-gray-100 text-gray-700">{record.status}</StatusPill>}
        subtitle={record.ntr_number}
        className="flex items-start justify-between gap-3 flex-wrap"
        actionsClassName="flex items-center gap-2 print:hidden"
        actions={
          <>
            <a href={`/api/ntr-records/${encodeURIComponent(record.id)}/export`} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {t('common.exportPdf')}
            </a>
            <a href={`/api/ntr-records/${encodeURIComponent(record.id)}/export`} download className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {t('ntr.downloadButton')}
            </a>
            <NtrPrintButton />
            <Link href="/ntr" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {t('common.backToList')}
            </Link>
            {allowDelete && <NtrDeleteButton id={record.id} ntrNumber={record.ntr_number} />}
          </>
        }
      />

      {/* Section 1: Registration Information */}
      <Card variant="compact" className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('ntr.registrationInfoTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label={t('csv.ntrNumber')} value={record.ntr_number} />
          <DetailRow label={t('common.dealer')} value={record.dealer_id} />
          <DetailRow label={t('common.branch')} value={branch?.name ?? 'N/A'} />
          <DetailRow label={t('ntr.registrationDate')} value={formatDateLocalized(record.created_at, locale)} />
          <DetailRow label={t('csv.retailDate')} value={record.retail_date ? formatDateLocalized(record.retail_date, locale) : 'N/A'} />
          <DetailRow label={t('csv.pdiDate')} value={record.pdi_date ? formatDateLocalized(record.pdi_date, locale) : 'N/A'} />
          <DetailRow label={t('csv.pdiNumber')} value={record.pdi_number ?? 'N/A'} />
          <DetailRow label={t('pdf.hourMeter')} value={record.hour_meter != null ? String(record.hour_meter) : 'N/A'} />
          <DetailRow label={t('csv.salesperson')} value={record.salesperson ?? 'N/A'} />
          <DetailRow label={t('ntr.registrationSource')} value={sourceLabel(record.source)} />
        </div>
      </Card>

      {/* Section 2: Tractor Information */}
      <Card variant="compact" className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('ntr.tractorInfoTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label={t('common.productFamily')} value={productFamily?.name ?? 'N/A'} />
          <DetailRow label={t('csv.model')} value={record.model ?? 'N/A'} />
          {record.variant && <DetailRow label={t('csv.variant')} value={record.variant} />}
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('common.serial')}</p>
            <p className="mt-1 text-sm text-gray-900">
              {record.serial}
              <Link href={`/vehicles/${encodeURIComponent(record.serial)}`} className="ml-2 text-xs text-brand-red hover:underline">
                {t('pmDetail.viewVehicle360')}
              </Link>
            </p>
          </div>
          <DetailRow label={t('common.engineNumber')} value={record.engine_number ?? 'N/A'} />
          {record.manufacturing_year && <DetailRow label={t('csv.manufacturingYear')} value={String(record.manufacturing_year)} />}
          <DetailRow label={t('csv.warrantyStatus')} value={warranty.status} />
          {/* Tractor Lifecycle foundation (MASP v1.1) - always shown, per
              spec ("Hide nothing"). This page's own record guarantees an
              NTR exists, so 'Delivered' is a safe fallback even in the
              unexpected case getVehicleSummary() itself returns null. */}
          <DetailRow label={t('csv.currentLifecycle')} value={t(`lifecycleStatus.${summary?.lifecycleStatus ?? 'Delivered'}`)} />
        </div>
      </Card>

      {/* Section 3: Customer Information */}
      <Card variant="compact" className="p-6">
        <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('ntr.customerInfoTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DetailRow label={t('pdf.customerName')} value={fullCustomerName} />
          <DetailRow label={t('pdf.customerPhone')} value={record.customer_phone} />
          {record.customer_type && <DetailRow label={t('csv.customerType')} value={record.customer_type} />}
          {record.customer_address && <DetailRow label={t('csv.customerAddress')} value={record.customer_address} />}
          {record.customer_subdistrict && <DetailRow label={t('csv.subdistrict')} value={record.customer_subdistrict} />}
          {record.customer_district && <DetailRow label={t('csv.district')} value={record.customer_district} />}
          {record.customer_province && <DetailRow label={t('csv.province')} value={record.customer_province} />}
          {record.customer_postal_code && <DetailRow label={t('csv.postalCode')} value={record.customer_postal_code} />}
        </div>
        {record.latitude !== null && record.longitude !== null && (
          <div className="mt-4 rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('pdf.gpsLocation')}</p>
            <p className="mt-1 text-sm text-gray-900">
              {record.latitude}, {record.longitude}
              {record.google_maps_url && (
                <a href={record.google_maps_url} target="_blank" rel="noreferrer" className="ml-2 text-xs text-brand-red hover:underline">
                  {t('pdf.openMap')}
                </a>
              )}
            </p>
          </div>
        )}
      </Card>

      {/* Section 4: Delivery Information */}
      {(record.salesperson || record.receiving_person) && (
        <Card variant="compact" className="p-6">
          <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('ntr.deliveryInfoTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label={t('ntr.dealerRepresentative')} value={record.salesperson ?? 'N/A'} />
            <DetailRow label={t('ntr.customerRepresentative')} value={record.receiving_person ?? 'N/A'} />
            <DetailRow label={t('ntr.acceptanceDate')} value={formatDateLocalized(record.delivery_date, locale)} />
          </div>
        </Card>
      )}

      {/* Section 5: Attachments - responsive 2-column gallery, hidden cards for anything not uploaded */}
      {attachments.length > 0 && (
        <Card variant="compact" className="p-6">
          <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('ntr.photosTitle')}</h2>
          <AttachmentGallery className="grid gap-3 sm:grid-cols-2" imgClassName="aspect-video w-full rounded border bg-gray-100 object-contain" items={attachments} linkable />
        </Card>
      )}

      {record.video_url && (
        <Card variant="compact" className="p-6">
          <h2 className="mb-2 text-sm font-semibold text-brand-dark">{t('pdf.videoLabel')}</h2>
          <a href={record.video_url} target="_blank" rel="noreferrer" className="text-sm text-brand-red hover:underline">
            {t('pdf.openVideo')}
          </a>
        </Card>
      )}

      {/* Section 6: Tractor Timeline - reuses the Platform Timeline, newest first */}
      {timeline.length > 0 && (
        <Card variant="compact" className="p-6">
          <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('ntr.timelineSectionTitle')}</h2>
          <Timeline className="space-y-3">
            {timeline.map((event, idx) => (
              <TimelineRow key={`${event.type}-${event.referenceNumber}-${idx}`} event={event} />
            ))}
          </Timeline>
        </Card>
      )}

      {/* Section 7: Current Tractor Status */}
      {summary && (
        <Card variant="compact" className="p-6">
          <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('ntr.currentStatusSectionTitle')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailRow label={t('ntr.currentOwner')} value={summary.ownerName ?? 'N/A'} />
            <DetailRow label={t('common.dealer')} value={summary.dealerName ?? 'N/A'} />
            <DetailRow label={t('csv.retailDate')} value={summary.retailDate ? formatDateLocalized(summary.retailDate, locale) : 'N/A'} />
            <DetailRow label={t('csv.warrantyStatus')} value={warranty.status} />
            <DetailRow label={t('common.healthScore')} value={String(summary.healthScore)} />
            <DetailRow label={t('common.compliance')} value={summary.compliancePercent != null ? `${summary.compliancePercent}%` : 'N/A'} />
            <DetailRow label={t('vehicle360.lastMaintenanceDate')} value={summary.lastMaintenanceDate ?? 'N/A'} />
            <DetailRow label={t('vehicle360.openMqrLabel')} value={String(summary.openMqrCount)} />
          </div>
        </Card>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-gray-400">
        {t('ntr.footerAppName')} — {t('ntr.footerGeneratedAt')}: {formatDateTimeLocalized(new Date(), locale)} — {t('ntr.footerGeneratedBy')}: {session.username} — {t('ntr.footerSystemVersion')}: MSEAL DMS v1.1
      </p>
    </div>
  );
}
