import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { seesAllDealers, canDelete, canForceDeleteLockedPm } from '@/lib/scope';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import { formatDateTimeLocalized } from '@/lib/thaiDate';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { evaluateMaintenanceLock } from '@/features/maintenance/utils/maintenanceLock';
import MaintenanceDeleteButton from './delete-button';
import MaintenanceUnlockButton from './unlock-button';
import MaintenanceGpsDetail from '@/features/maintenance/components/maintenance-gps-detail';
import MaintenanceImageGallery from '@/features/maintenance/components/MaintenanceImageGallery';
import { maintenanceRecordToImageItems } from '@/features/maintenance/utils/maintenanceImageItems';
import { t, getServerLocale } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import DetailRow from '@/components/shared/layout/DetailRow';

interface RouteParams {
  params: {
    id: string;
  };
}

export const dynamic = 'force-dynamic';

export default async function PmRecordDetailPage({ params }: RouteParams) {
  const session = await getSession();

  // Direct repository/service call (matching NTR's `ntr/[id]/page.tsx` and
  // MQR's `records/[jobId]/page.tsx`) - previously this Server Component
  // self-fetched `/api/pm-records/[id]` over HTTP, an extra network hop
  // that could fail independently of the record/permission/route actually
  // being correct (see PROJECT_STATE.md's M6.5 entry for this exact
  // failure class hitting this same page before).
  let record;
  try {
    const repository = new SupabaseMaintenanceRepository();
    record = await new MaintenanceService(repository).getById(params.id, session ?? undefined);
  } catch (error) {
    console.error('PM record detail load error', error);
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

        <EmptyState icon="⚠️" title={t('pmDetail.title')} reason={t('pmDetail.errorPrefix', { error: t('pmDetail.unexpectedError') })} nextStep={t('pmDetail.errorNextStep')} />
      </div>
    );
  }

  if (!record) {
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

  // Dealer/Branch Scope Platform Standard, defense in depth - `getById`
  // above already applies scope internally (returns null when out of
  // scope), this re-check matches the same two-layer pattern
  // `api/pm-records/[id]/route.ts`'s own `isOutOfScope` provides today.
  if (session && !canAccessDealerBranch(session, record.dealer_id, record.branch_id)) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('pmDetail.title')} />
        <EmptyState icon="🔒" title={t('pmDetail.unauthorizedTitle')} reason={t('validation.unauthorizedRecordAccess')} nextStep={t('pmDetail.unauthorizedNextStep')} />
      </div>
    );
  }

  const lock = evaluateMaintenanceLock(record);

  const canManageLock = session ? seesAllDealers(session.role) : false; // SuperAdmin/CentralAdmin
  const canForceDelete = session ? canForceDeleteLockedPm(session.role) : false;
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

        {maintenanceRecordToImageItems(record, {
          meter: t('pdf.photoMeter'),
          nameplate: t('pdf.photoNameplate'),
          report: t('pdf.photoReport'),
        }).length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-brand-dark">{t('pmDetail.photosTitle')}</h2>
            <div className="mt-2">
              <MaintenanceImageGallery
                items={maintenanceRecordToImageItems(record, {
                  meter: t('pdf.photoMeter'),
                  nameplate: t('pdf.photoNameplate'),
                  report: t('pdf.photoReport'),
                })}
                labels={{
                  zoomIn: t('attachmentViewer.zoomIn'),
                  zoomOut: t('attachmentViewer.zoomOut'),
                  rotate: t('attachmentViewer.rotateRight'),
                  reset: t('attachmentViewer.reset'),
                }}
                navigationLabels={{
                  previous: t('attachmentViewer.previous'),
                  next: t('attachmentViewer.next'),
                  close: t('attachmentViewer.close'),
                }}
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
