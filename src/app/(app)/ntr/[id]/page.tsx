import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { canDelete } from '@/lib/scope';
import { formatDateTimeLocalized, formatDateLocalized } from '@/lib/thaiDate';
import { createNtrService } from '@/features/ntr/factory';
import NtrDeleteButton from './delete-button';
import { t, getServerLocale } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import AttachmentGallery, { AttachmentGalleryItem } from '@/components/shared/attachments/AttachmentGallery';
import DetailRow from '@/components/shared/layout/DetailRow';

interface RouteParams {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

export default async function NtrDetailPage({ params }: RouteParams) {
  const session = await getSession();
  if (!session) return null;
  const locale = getServerLocale();

  const record = await createNtrService().getById(params.id);

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

  // Zero-leakage: a non-privileged actor may only view their own dealer's record.
  if (session.dealerId && record.dealer_id !== session.dealerId) {
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

  const requiredPhotos: AttachmentGalleryItem[] = [
    record.photo_customer_tractor_url && { key: 'customer_tractor', url: record.photo_customer_tractor_url, alt: t('pdf.photoCustomerTractor'), caption: t('pdf.photoCustomerTractor') },
    record.photo_serial_plate_url && { key: 'serial_plate', url: record.photo_serial_plate_url, alt: t('pdf.photoSerialPlate'), caption: t('pdf.photoSerialPlate') },
    record.photo_hour_meter_url && { key: 'hour_meter', url: record.photo_hour_meter_url, alt: t('pdf.photoHourMeterNtr'), caption: t('pdf.photoHourMeterNtr') },
    record.photo_signed_document_url && { key: 'signed_document', url: record.photo_signed_document_url, alt: t('pdf.photoSignedDocument'), caption: t('pdf.photoSignedDocument') },
  ].filter(Boolean) as AttachmentGalleryItem[];

  const additionalPhotos: AttachmentGalleryItem[] = record.additional_photos.map((p, i) => ({
    key: `additional_${i}`,
    url: p.url,
    alt: p.label,
    caption: p.label,
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('ntr.detailTitle')}
        titleAdornments={<span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{record.status}</span>}
        subtitle={record.ntr_number}
        actions={
          <>
            <a href={`/api/ntr-records/${encodeURIComponent(record.id)}/export`} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {t('common.exportPdf')}
            </a>
            <Link href="/ntr" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {t('common.backToList')}
            </Link>
            {allowDelete && <NtrDeleteButton id={record.id} ntrNumber={record.ntr_number} />}
          </>
        }
      />

      <Card variant="compact" className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailRow label={t('csv.ntrNumber')} value={record.ntr_number} />
          <DetailRow label={t('common.dealer')} value={record.dealer_id} />
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('common.serial')}</p>
            <p className="mt-1 text-sm text-gray-900">
              {record.serial}
              <Link href={`/vehicles/${encodeURIComponent(record.serial)}`} className="ml-2 text-xs text-brand-red hover:underline">
                {t('pmDetail.viewVehicle360')}
              </Link>
            </p>
          </div>
          <DetailRow label={t('csv.model')} value={record.model ?? 'N/A'} />
          <DetailRow label={t('common.engineNumber')} value={record.engine_number ?? 'N/A'} />
          <DetailRow label={t('csv.retailDate')} value={record.retail_date ? formatDateLocalized(record.retail_date, locale) : 'N/A'} />
          <DetailRow label={t('csv.deliveryDate')} value={formatDateLocalized(record.delivery_date, locale)} />
          <DetailRow label={t('pdf.hourMeter')} value={record.hour_meter != null ? String(record.hour_meter) : 'N/A'} />
          <DetailRow label={t('pdf.customerName')} value={record.customer_name} />
          <DetailRow label={t('pdf.customerPhone')} value={record.customer_phone} />
          <DetailRow label={t('csv.customerType')} value={record.customer_type ?? 'N/A'} />
          <DetailRow label={t('csv.customerAddress')} value={record.customer_address ?? 'N/A'} />
          <DetailRow label={t('csv.district')} value={record.customer_district ?? 'N/A'} />
          <DetailRow label={t('csv.province')} value={record.customer_province ?? 'N/A'} />
          <DetailRow label={t('csv.postalCode')} value={record.customer_postal_code ?? 'N/A'} />
          <DetailRow label={t('csv.salesperson')} value={record.salesperson ?? 'N/A'} />
          <DetailRow label={t('csv.receivingPerson')} value={record.receiving_person ?? 'N/A'} />
          <DetailRow label={t('common.createdBy')} value={record.created_by} />
          <DetailRow label={t('common.createdAt')} value={formatDateTimeLocalized(record.created_at, locale)} />
          <DetailRow label={t('common.updatedBy')} value={record.updated_by ?? 'N/A'} />
          <DetailRow label={t('common.updatedAt')} value={formatDateTimeLocalized(record.updated_at, locale)} />
        </div>

        {record.latitude !== null && record.longitude !== null && (
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
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

        {requiredPhotos.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-brand-dark">{t('ntr.photosTitle')}</h2>
            <div className="mt-2">
              <AttachmentGallery className="grid gap-3 sm:grid-cols-4" imgClassName="h-32 w-full rounded border object-cover" items={requiredPhotos} linkable />
            </div>
          </div>
        )}

        {additionalPhotos.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-brand-dark">{t('ntr.additionalPhotosTitle')}</h2>
            <div className="mt-2">
              <AttachmentGallery className="grid gap-3 sm:grid-cols-4" imgClassName="h-32 w-full rounded border object-cover" items={additionalPhotos} linkable />
            </div>
          </div>
        )}

        {record.video_url && (
          <div>
            <h2 className="text-sm font-semibold text-brand-dark">{t('pdf.videoLabel')}</h2>
            <a href={record.video_url} target="_blank" rel="noreferrer" className="text-sm text-brand-red hover:underline">
              {t('pdf.openVideo')}
            </a>
          </div>
        )}
      </Card>
    </div>
  );
}
