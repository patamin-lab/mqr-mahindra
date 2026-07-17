import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { canAccessDealerBranch, resolveDealerScope } from '@/lib/dealerBranchScope';
import { getVehicleBySerial } from '@/lib/db';
import { createNtrService } from '@/features/ntr/factory';
import { resolveNtrAttachmentUrls } from '@/features/ntr/utils/resolveNtrAttachmentUrls';
import { MasterDataService } from '@/shared/master-data';
import { seesAllDealers } from '@/lib/scope';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import EmptyState from '@/components/shared/layout/EmptyState';
import NtrEditForm from './NtrEditForm';

interface RouteParams {
  params: { id: string };
}

export const dynamic = 'force-dynamic';

/** NTR Edit - same PUT /api/ntr-records/[id] the record already exposed;
 *  this screen was the missing UI for it. Authorization mirrors the route
 *  itself (dealer/branch scope only, no extra role gate - the route never
 *  had one beyond scope, see `api/ntr-records/[id]/route.ts`'s `PUT`).
 *  Vehicle master fields (serial/model/engine number/product family) are
 *  never editable here - they come only from `vehicles`, never duplicated/
 *  overwritten by this form. */
export default async function NtrEditPage({ params }: RouteParams) {
  const session = await getSession();
  if (!session) return null;

  const record = await createNtrService().getById(params.id, session);

  if (!record) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('ntr.editTitle')} />
        <EmptyState icon="🔍" title={t('ntr.notFound')} reason={t('ntr.notFoundReason')} nextStep={t('ntr.notFoundNextStep')} />
      </div>
    );
  }

  if (!canAccessDealerBranch(session, record.dealer_id, record.branch_id)) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('ntr.editTitle')} />
        <EmptyState icon="🔒" title={t('ntr.unauthorizedTitle')} reason={t('validation.unauthorizedRecordAccess')} nextStep={t('ntr.unauthorizedNextStep')} />
      </div>
    );
  }

  await resolveNtrAttachmentUrls(record);

  // Vehicle Master / Factory Domain display data - resolved here (same
  // pattern the detail page already uses for branch/product family),
  // never re-derived by the form itself. Branches are scoped to this
  // record's own (fixed) dealer - the form's own client-side Dealer
  // change handler refetches a different dealer's branches on demand
  // (`ntr-form.tsx`'s `handleDealerChange`), so this list only ever needs
  // to be the *starting* one. Model/Engine Number/Sub Model are
  // point-in-time snapshots already on the NTR record itself (never a
  // live join back to `vehicles` - see `NtrRecord`'s own doc comment);
  // Product Code has no such snapshot column, so it's the one field here
  // resolved live via `getVehicleBySerial` (previously always `null` - a
  // gap fixed by the NTR Form Update, 2026-07). `dealers` (the full active
  // list) is only fetched for a `seesAllDealers` actor - the one role
  // allowed to actually change Dealer here (also NTR Form Update,
  // 2026-07) - mirroring `ntr/new/page.tsx`'s own `showDealerField` gate.
  const showDealerField = seesAllDealers(session.role);
  const [dealer, productFamily, branches, vehicle, dealers] = await Promise.all([
    MasterDataService.getDealerById(record.dealer_id),
    record.product_family_id ? MasterDataService.getProductFamilyById(record.product_family_id) : Promise.resolve(null),
    MasterDataService.getBranchesForDealer(record.dealer_id),
    getVehicleBySerial(record.serial, resolveDealerScope(session)),
    showDealerField ? MasterDataService.getDealers() : Promise.resolve([]),
  ]);

  const vehicleInfo = {
    serial: record.serial,
    model: record.model,
    engineNumber: record.engine_number,
    productCode: vehicle?.product_code ?? null,
    dealerLabel: dealer?.short_name ?? dealer?.full_name ?? record.dealer_id,
    productFamilyName: productFamily?.name ?? null,
    subModel: record.variant,
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('ntr.editTitle')}
        subtitle={record.ntr_number}
        actions={
          <Link href={`/ntr/${encodeURIComponent(record.id)}`} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            {t('common.cancel')}
          </Link>
        }
      />
      <NtrEditForm
        record={record}
        vehicleInfo={vehicleInfo}
        branches={branches}
        dealers={dealers}
        role={session.role}
        sessionDealerId={session.dealerId}
      />
    </div>
  );
}
