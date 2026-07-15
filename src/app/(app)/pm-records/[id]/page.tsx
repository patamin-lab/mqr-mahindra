import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { seesAllDealers, canDelete } from '@/lib/scope';
import { formatDateTimeLocalized } from '@/lib/thaiDate';
import { fetchMaintenance } from '@/features/maintenance/utils/fetchMaintenance';
import { evaluateMaintenanceLock } from '@/features/maintenance/utils/maintenanceLock';
import MaintenanceDeleteButton from './delete-button';
import MaintenanceUnlockButton from './unlock-button';
import MaintenanceGpsDetail from '@/features/maintenance/components/maintenance-gps-detail';
import { t, getServerLocale } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import AttachmentGallery, { AttachmentGalleryItem } from '@/components/shared/attachments/AttachmentGallery';
import DetailRow from '@/components/shared/layout/DetailRow';
import { AttachmentService } from '@/shared/attachments';

const attachmentService = new AttachmentService();

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function PmRecordDetailPage({ params }: RouteParams) {
  const session = await getSession();
  const result = await fetchMaintenance(params.id);

  if ('notFound' in result && result.notFound) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('pmDetail.title')}
          subtitle={t('pmDetail.recordIdLabel', { id: params.id })}
          actions={
            <Link href="/pm-records" className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark">
              {t('common.backToList')}
            </Link>
          }
        />

        <EmptyState icon="🔍" title={t('pmDetail.notFound')} reason={t('pmDetail.notFoundReason')} nextStep={t('pmDetail.notFoundNextStep')} />
      </div>
    );
  }

  if ('error' in result) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('pmDetail.title')}
          subtitle={t('pmDetail.recordIdLabel', { id: params.id })}
          actions={
            <Link href="/pm-records" className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark">
              {t('common.backToList')}
            </Link>
          }
        />

        <EmptyState icon="⚠️" title={t('pmDetail.title')} reason={t('pmDetail.errorPrefix', { error: result.error })} nextStep={t('pmDetail.errorNextStep')} />
      </div>
    );
  }

  if (!('record' in result)) {
    return (
      <div className="space-y-4">
        <PageHeader
          title={t('pmDetail.title')}
          subtitle={t('pmDetail.recordIdLabel', { id: params.id })}
          actions={
            <Link href="/pm-records" className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark">
              {t('common.backToList')}
            </Link>
          }
        />

        <EmptyState icon="⚠️" title={t('pmDetail.title')} reason={t('pmDetail.unexpectedError')} nextStep={t('pmDetail.unexpectedErrorNextStep')} />
      </div>
    );
  }

  const record = result.record;
  const lock = evaluateMaintenanceLock(record);

  // A photo uploaded via the Attachment Platform stores its display URL
  // as a Supabase signed URL that expires - resolve a fresh one here,
  // server-side (see docs/engineering/ATTACHMENT_FRAMEWORK.md).
  if (record.meter_photo_attachment_id) {
    const resolved = await attachmentService.getUrl(record.meter_photo_attachment_id).catch(() => null);
    if (resolved) record.meter_photo_url = resolved.url;
  }
  if (record.nameplate_photo_attachment_id) {
    const resolved = await attachmentService.getUrl(record.nameplate_photo_attachment_id).catch(() => null);
    if (resolved) record.nameplate_photo_url = resolved.url;
  }
  if (record.report_photo_attachment_id) {
    const resolved = await attachmentService.getUrl(record.report_photo_attachment_id).catch(() => null);
    if (resolved) record.report_photo_url = resolved.url;
  }

  const canManageLock = session ? seesAllDealers(session.role) : false; // SuperAdmin/CentralAdmin
  const canForceDelete = session?.role === 'SuperAdmin';
  const allowDelete = session ? canDelete(session.role) : false;
  const locale = getServerLocale();

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('pmDetail.title')}
        titleAdornments={
          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">{record.status}</span>
        }
        subtitle={record.pm_number ?? record.serial ?? t('common.pm')}
        actions={
          <>
            <a
              href={`/api/pm-records/${encodeURIComponent(record.id)}/export`}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
            >
              {t('common.exportPdf')}
            </a>
            <Link
              href={`/pm-records/${encodeURIComponent(record.id)}/edit`}
              className="rounded bg-brand-red px-4 py-2 text-white hover:bg-brand-dark"
            >
              {t('common.edit')}
            </Link>
            <Link href="/pm-records" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {t('common.backToList')}
            </Link>
            {lock.locked && canManageLock && <MaintenanceUnlockButton id={record.id} />}
            {allowDelete && (
              <MaintenanceDeleteButton id={record.id} locked={lock.locked} canForceDelete={canForceDelete} />
            )}
          </>
        }
      />

      {lock.locked && (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          🔒 {t('pmDetail.lockedBannerPrefix', { reason: t(`lockReason.${lock.reason}`) })}
          {canManageLock && t('pmDetail.lockedBannerUnlockHint')}
        </div>
      )}

      <Card variant="compact" className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <DetailRow label={t('csv.pmNumber')} value={record.pm_number ?? 'N/A'} />
          <DetailRow label={t('pmDetail.dealerId')} value={record.dealer_id} />
          <DetailRow label={t('pmDetail.branchId')} value={record.branch_id ?? 'N/A'} />
          <div className="rounded border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">{t('common.serial')}</p>
            <p className="mt-1 text-sm text-gray-900">
              {record.serial ?? 'N/A'}
              {record.serial && (
                <Link
                  href={`/machines/${encodeURIComponent(record.serial)}`}
                  className="ml-2 text-xs text-brand-red hover:underline"
                >
                  {t('pmDetail.viewVehicle360')}
                </Link>
              )}
            </p>
          </div>
          <DetailRow label={t('common.model')} value={record.model ?? 'N/A'} />
          <DetailRow label={t('common.engineNumber')} value={record.engine_number ?? 'N/A'} />
          <DetailRow label={t('pdf.deliveryDate')} value={record.delivery_date ?? 'N/A'} />
          <DetailRow label={t('pdf.customerName')} value={record.customer_name ?? 'N/A'} />
          <DetailRow label={t('pdf.customerPhone')} value={record.customer_phone ?? 'N/A'} />
          <DetailRow label={t('common.hourMeter')} value={record.hour_meter != null ? String(record.hour_meter) : 'N/A'} />
          <DetailRow label={t('pmDetail.technicianId')} value={record.technician_id ?? 'N/A'} />
          <DetailRow label={t('common.status')} value={record.status} />
          <DetailRow label={t('pmDetail.scheduledDate')} value={record.scheduled_date ?? 'N/A'} />
          <DetailRow label={t('common.performedDate')} value={record.performed_date ?? 'N/A'} />
          <DetailRow label={t('common.createdBy')} value={record.created_by ?? 'N/A'} />
          <DetailRow label={t('common.createdAt')} value={formatDateTimeLocalized(record.created_at, locale)} />
          <DetailRow label={t('common.updatedBy')} value={record.updated_by ?? 'N/A'} />
          <DetailRow label={t('common.updatedAt')} value={formatDateTimeLocalized(record.updated_at, locale)} />
        </div>

        {record.latitude !== null && record.longitude !== null && (
          <MaintenanceGpsDetail
            latitude={record.latitude}
            longitude={record.longitude}
            accuracy={record.gps_accuracy}
            googleMapsUrl={record.google_maps_url}
          />
        )}

        {(record.meter_photo_url || record.nameplate_photo_url || record.report_photo_url) && (
          <div>
            <h2 className="text-sm font-semibold text-brand-dark">{t('pmDetail.photosTitle')}</h2>
            <div className="mt-2">
              <AttachmentGallery
                className="grid gap-3 sm:grid-cols-3"
                imgClassName="h-32 w-full rounded border object-cover"
                items={
                  [
                    record.meter_photo_url && { key: 'meter', url: record.meter_photo_url, alt: t('pdf.photoMeter') },
                    record.nameplate_photo_url && { key: 'nameplate', url: record.nameplate_photo_url, alt: t('pdf.photoNameplate') },
                    record.report_photo_url && { key: 'report', url: record.report_photo_url, alt: t('pdf.photoReport') },
                  ].filter(Boolean) as AttachmentGalleryItem[]
                }
              />
            </div>
          </div>
        )}

        <div>
          <h2 className="text-sm font-semibold text-brand-dark">{t('common.notes')}</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{record.notes ?? t('pmDetail.noNotes')}</p>
        </div>
      </Card>
    </div>
  );
}
