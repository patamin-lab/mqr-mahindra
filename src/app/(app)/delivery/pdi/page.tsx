import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { InspectionService, type InspectionStatus, type Inspection } from '@/features/inspection';
import { canAccessImportInspection } from '@/lib/scope';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { listVehiclesByFactoryPdiStatus, FACTORY_PDI_STATUS_PENDING_SENTINEL, isMissingFactoryPdiStatusColumnError, type VehicleFactoryPdiStatusResult } from '@/lib/db';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import SearchToolbar from '@/components/shared/layout/SearchToolbar';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import StatusPill from '@/components/shared/status/StatusPill';
import RowLink from '@/components/shared/table/RowLink';
import ActionColumn from '@/components/shared/table/ActionColumn';

const service = new InspectionService();
const STATUSES: InspectionStatus[] = ['Scheduled', 'InProgress', 'Completed', 'Cancelled'];

/** Real, live Tractor IN sheet values (verified 2026-07-15) plus the
 *  `Pending` sentinel for "no value recorded yet" - never an invented
 *  enum. Key is the sheet's own literal value (or the sentinel); label
 *  key maps to a filesystem/JSON-safe locale key. */
const FACTORY_PDI_STATUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: FACTORY_PDI_STATUS_PENDING_SENTINEL, labelKey: 'Pending' },
  { value: 'QC Passed', labelKey: 'QcPassed' },
  { value: 'Quarantine', labelKey: 'Quarantine' },
];

/**
 * Import Inspection list (ADR-017, business-domain correction). Screen
 * Contract: Purpose - find an Import Inspection event by status/serial/
 * technician, OR find a machine by Tractor IN's own Factory PDI Status
 * (Production Pilot). Primary User - MSEAL technician/inspector. Primary
 * Decision - "is this machine ready to release to a dealer" / "which
 * machines are still waiting on the factory side." Primary Action - open
 * an inspection, start a new one, start a RE-PDI. Permissions - belongs
 * exclusively to MSEAL (`canAccessImportInspection`) - Dealer roles never
 * see this screen.
 *
 * Factory PDI Status filtering is vehicle-centric, not inspection-
 * centric, and deliberately reuses this same page/table rather than a
 * new one: a vehicle the factory marked `Pending` (or any other status)
 * may have no Inspection record at all yet - that vehicle must still
 * show up as "waiting for inspection," which a naive filter over
 * `inspections` alone could never surface. When this filter is inactive,
 * the table's rows and query are byte-for-byte the original
 * inspection-only behavior - zero regression for the common case.
 */
export default async function PdiListPage({ searchParams }: { searchParams?: { status?: string; q?: string; factoryPdiStatus?: string } }) {
  const session = await getSession();
  if (!session) return null;
  if (!canAccessImportInspection(session.role)) {
    return (
      <div className="space-y-4">
        <PageHeader title={t('pdi.title')} />
        <EmptyState icon="🔒" title={t('pdi.forbiddenTitle')} reason={t('pdi.forbiddenReason')} nextStep={t('pdi.forbiddenNextStep')} />
      </div>
    );
  }

  const params = searchParams ?? {};
  const factoryPdiStatus = FACTORY_PDI_STATUS_OPTIONS.some((o) => o.value === params.factoryPdiStatus) ? params.factoryPdiStatus : undefined;
  const status = STATUSES.includes(params.status as InspectionStatus) ? (params.status as InspectionStatus) : undefined;
  const clearHref = params.q || params.status || factoryPdiStatus ? '/delivery/pdi' : undefined;

  let vehicleRows: { vehicle: VehicleFactoryPdiStatusResult; inspection: Inspection | null }[] | null = null;
  let inspections: Inspection[] = [];

  if (factoryPdiStatus) {
    const scope = resolveDealerScope(session, null);
    try {
      let vehicles = await listVehiclesByFactoryPdiStatus(factoryPdiStatus, scope.dealerId ?? undefined);
      if (params.q) {
        const q = params.q.toLowerCase();
        vehicles = vehicles.filter((v) => v.serial.toLowerCase().includes(q) || (v.model ?? '').toLowerCase().includes(q));
      }
      const serials = vehicles.map((v) => v.serial);
      const matchedInspections = serials.length > 0 ? await service.listInspections({ serials }, session) : [];
      const latestBySerial = new Map<string, Inspection>();
      for (const i of matchedInspections) {
        const existing = latestBySerial.get(i.serial);
        if (!existing || i.inspectionSequence > existing.inspectionSequence) latestBySerial.set(i.serial, i);
      }
      vehicleRows = vehicles.map((vehicle) => ({ vehicle, inspection: latestBySerial.get(vehicle.serial) ?? null }));
    } catch (err) {
      if (!isMissingFactoryPdiStatusColumnError(err)) throw err;
      console.error('Factory PDI status column unavailable; using inspection list fallback', err);
      inspections = await service.listInspections({ status, q: params.q }, session);
      vehicleRows = null;
    }
  } else {
    inspections = await service.listInspections({ status, q: params.q }, session);
  }

  return (
    <div>
      <PageHeader
        title={t('pdi.title')}
        subtitle={t('pdi.subtitle')}
        titleClassName="text-2xl font-bold text-brand-dark"
        className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/delivery/pdi/dashboard" className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
              {t('pdi.dashboardTitle')}
            </Link>
            <Link href="/delivery/pdi/new" className="btn-primary">
              {t('pdi.newAction')}
            </Link>
          </div>
        }
      />

      <SearchToolbar
        cardClassName="mb-4 flex flex-wrap items-end gap-3 p-4"
        filterLabel={t('common.filter')}
        filterButtonClassName="rounded border border-gray-300 bg-gray-50 px-4 py-2 text-sm transition hover:bg-gray-100"
        clearHref={clearHref}
        clearLabel={t('common.clearFilter')}
      >
        <div>
          <label className="mb-1 block text-xs font-medium">{t('common.search')}</label>
          <input name="q" defaultValue={params.q ?? ''} placeholder={t('pdi.searchPlaceholder')} className="w-64 rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('pdi.statusLabel')}</label>
          <select name="status" defaultValue={params.status ?? ''} className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">{t('pdi.statusAllLabel')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`pdi.status.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">{t('pdi.factoryPdiStatusLabel')}</label>
          <select name="factoryPdiStatus" defaultValue={factoryPdiStatus ?? ''} className="rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">{t('pdi.factoryPdiStatusAllLabel')}</option>
            {FACTORY_PDI_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(`pdi.factoryPdiStatus.${o.labelKey}`)}
              </option>
            ))}
          </select>
        </div>
      </SearchToolbar>

      {factoryPdiStatus && <p className="mb-3 text-xs text-gray-500">{t('pdi.factoryPdiStatusFilterNote')}</p>}

      {vehicleRows !== null ? (
        vehicleRows.length === 0 ? (
          <EmptyState icon="📋" title={t('pdi.title')} reason={t('pdi.emptyListReason')} nextStep={t('pdi.emptyListNextStep')} />
        ) : (
          <Card variant="elevated" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left">{t('pdi.serialLabel')}</th>
                  <th className="px-4 py-3 text-left">{t('pdi.modelLabel')}</th>
                  <th className="px-4 py-3 text-left">{t('pdi.factoryPdiStatusColumnLabel')}</th>
                  <th className="px-4 py-3 text-left">{t('pdi.inspectionRefLabel')}</th>
                  <th className="px-4 py-3 text-left">{t('pdi.statusLabel')}</th>
                  <th className="px-4 py-3 text-left">{t('pdi.resultLabel')}</th>
                  <th className="px-4 py-3 text-left">{t('pdi.releaseStatusLabel')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehicleRows.map(({ vehicle, inspection }) => (
                  <tr key={vehicle.id} className="relative hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono">
                      {inspection && <RowLink href={`/delivery/pdi/${inspection.id}`} label={inspection.inspectionRef} />}
                      <span className="relative">{vehicle.serial}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{vehicle.model ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {vehicle.factoryPdiStatus ? t(`pdi.factoryPdiStatus.${vehicle.factoryPdiStatus === 'QC Passed' ? 'QcPassed' : vehicle.factoryPdiStatus}`) : t('pdi.factoryPdiStatus.Pending')}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {inspection ? (
                        <Link href={`/delivery/pdi/${inspection.id}`} className="relative z-10 text-brand-red hover:underline">
                          {inspection.inspectionRef}
                        </Link>
                      ) : (
                        <Link href="/delivery/pdi/new" className="relative z-10 text-brand-red hover:underline">
                          {t('pdi.startInspectionAction')}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill colorClassName="bg-gray-100 text-gray-700">
                        {inspection ? t(`pdi.status.${inspection.status}`) : t('pdi.notStartedLabel')}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{inspection?.result ? t(`pdi.result.${inspection.result}`) : '-'}</td>
                    <td className="px-4 py-3 text-gray-500">{inspection ? t(`pdi.releaseStatus.${inspection.releaseStatus}`) : '-'}</td>
                    <td className="relative z-10 px-4 py-3">
                      {inspection && (
                        <ActionColumn actions={[{ key: 'view', iconName: 'view', label: t('common.view'), href: `/delivery/pdi/${inspection.id}`, variant: 'view' }]} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )
      ) : inspections.length === 0 ? (
        <EmptyState icon="📋" title={t('pdi.title')} reason={t('pdi.emptyListReason')} nextStep={t('pdi.emptyListNextStep')} />
      ) : (
        <Card variant="elevated" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">{t('pdi.inspectionRefLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.serialLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.typeLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.technicianLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.statusLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.resultLabel')}</th>
                <th className="px-4 py-3 text-left">{t('pdi.releaseStatusLabel')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inspections.map((i) => (
                <tr key={i.id} className="relative hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">
                    <RowLink href={`/delivery/pdi/${i.id}`} label={i.inspectionRef} />
                    <span className="relative text-brand-red">{i.inspectionRef}</span>
                  </td>
                  <td className="px-4 py-3">{i.serial}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {i.inspectionType === 'RE_PDI' ? `${t('pdi.type.RE_PDI')} #${i.inspectionSequence}` : t('pdi.type.PDI')}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{i.technicianName}</td>
                  <td className="px-4 py-3">
                    <StatusPill colorClassName="bg-gray-100 text-gray-700">{t(`pdi.status.${i.status}`)}</StatusPill>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{i.result ? t(`pdi.result.${i.result}`) : '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{t(`pdi.releaseStatus.${i.releaseStatus}`)}</td>
                  <td className="relative z-10 px-4 py-3">
                    <ActionColumn actions={[{ key: 'view', iconName: 'view', label: t('common.view'), href: `/delivery/pdi/${i.id}`, variant: 'view' }]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
