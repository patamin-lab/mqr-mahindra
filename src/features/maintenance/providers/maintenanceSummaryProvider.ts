/**
 * MaintenanceSummaryProvider — this module's contribution to Vehicle 360.
 *
 * Implements `VehicleSummaryProvider` (owned by `vehicle/types.ts`) so
 * Vehicle 360 never needs to import anything from this module directly.
 * Resolves Product Family, loads this vehicle's *pinned* Maintenance
 * Program Version (never the live/editable one - see
 * `resolveVehicleProgramVersionStages()` in `lib/db.ts`), loads this
 * vehicle's maintenance history, and delegates all business-rule
 * computation to `MaintenanceDueService` - this file is orchestration only.
 */
import { getProductFamilyIdForModel, getProductFamily, getVehicleBySerial, resolveVehicleProgramVersionStages } from '@/lib/db';
import { SessionUser } from '@/lib/types';
import { MaintenanceDueService } from '@/features/maintenance-due/service';
import { MaintenanceHistoryEntry, MaintenanceProgramStage } from '@/features/maintenance-due/types';
import { VehicleSummary, VehicleSummaryProvider } from '@/features/vehicle/types';
import { fetchMaintenanceHistoryForSerial } from '../utils/fetchMaintenanceHistory';

const maintenanceDueService = new MaintenanceDueService();

export class MaintenanceSummaryProvider implements VehicleSummaryProvider {
  async getVehicleSummary(serial: string, session: SessionUser): Promise<Partial<VehicleSummary> | null> {
    const [vehicle, records] = await Promise.all([
      getVehicleBySerial(serial, session.dealerId ?? null),
      fetchMaintenanceHistoryForSerial(serial, session),
    ]);
    // A vehicle unknown to Vehicle Master (shouldn't normally happen, since
    // callers only reach this after resolving the vehicle itself elsewhere)
    // has no Product Family to resolve against - contribute nothing rather
    // than guessing.
    const model = vehicle?.model ?? records[0]?.model ?? null;

    // Tractor IN sync (`TractorInSyncService`) is now the source of truth
    // for `vehicles.product_family_id` - prefer it. The `model`-based
    // derivation is a temporary migration safeguard for a vehicle that
    // hasn't been synced yet (e.g. no Product Family match in the sheet,
    // or the sync simply hasn't run for it).
    //
    // KEEP THIS FALLBACK (v2.3.1 review, 2026-07-09): not yet safe to
    // remove. Verified live: 290/333 vehicles have `product_family_id` set
    // (all from the one-time `product_family_models` backfill migration,
    // not yet from a real sheet sync); the remaining 43 have no entry in
    // `product_family_models` for their `model` at all, so a sync can't
    // backfill them either until the Tractor IN sheet's own `Product
    // Family` column is populated (still empty sheet-wide as of this
    // date - see ADR-012). Removing this fallback today would silently
    // drop Product Family (and every PM computation that depends on it)
    // for those 43 vehicles.
    // TODO(tractor-in-sync): remove this fallback once a production sync
    // has run against a sheet with real Product Family data and
    // `select count(*) from vehicles where product_family_id is null` is 0
    // (or the remaining nulls are confirmed to be genuinely retired/out-of-
    // fleet vehicles, not a sync gap).
    const productFamilyId = vehicle?.product_family_id ?? (model ? await getProductFamilyIdForModel(model) : null);
    const [productFamily, versionResolution] = await Promise.all([
      productFamilyId ? getProductFamily(productFamilyId) : Promise.resolve(null),
      productFamilyId && vehicle
        ? resolveVehicleProgramVersionStages(vehicle.id, productFamilyId, vehicle.delivery_date)
        : Promise.resolve(null),
    ]);
    const stages = versionResolution?.stages ?? [];

    const latestMaintenance = records[0] ?? null;
    const history: MaintenanceHistoryEntry[] = records
      .filter((r) => r.performed_date)
      .map((r) => ({ performedDate: r.performed_date as string, hourMeter: r.hour_meter, pmIntervalId: r.pm_interval_id }));
    // pm_interval_id on a version snapshot row is nullable in the schema
    // (traceability only), but in practice always populated - snapshots are
    // only ever created from a live assignment set, which always has one.
    // Defensively skip any stage that somehow lost it rather than fabricate
    // an id.
    const dueStages: MaintenanceProgramStage[] = stages
      .filter((s): s is typeof s & { pmIntervalId: string } => s.pmIntervalId !== null)
      .map((s) => ({
        pmIntervalId: s.pmIntervalId,
        label: s.label,
        intervalHours: s.intervalHours,
        intervalMonths: s.intervalMonths,
      }));

    const currentDate = new Date().toISOString().slice(0, 10);
    const { due, compliance, lastCompletedOnSchedule } = maintenanceDueService.evaluate({
      currentHourMeter: latestMaintenance?.hour_meter ?? null,
      currentDate,
      stages: dueStages,
      history,
    });

    const incompleteMaintenancePhotos = latestMaintenance
      ? !latestMaintenance.meter_photo_url || !latestMaintenance.nameplate_photo_url || !latestMaintenance.report_photo_url
      : false;
    const missingGps = latestMaintenance ? latestMaintenance.latitude == null || latestMaintenance.longitude == null : false;

    return {
      productFamilyId: productFamilyId ?? null,
      productFamilyName: productFamily?.name ?? null,
      maintenanceProgramStages: stages.map((s) => ({ label: s.label, intervalHours: s.intervalHours, intervalMonths: s.intervalMonths })),
      maintenanceProgramVersionNumber: versionResolution?.versionNumber ?? null,

      currentHourMeter: latestMaintenance?.hour_meter ?? null,
      lastMaintenanceDate: due.lastMaintenanceDate,
      nextMaintenanceLabel: due.nextMaintenanceLabel,
      nextMaintenanceDueDate: due.nextMaintenanceDueDate,
      nextMaintenanceDueHours: due.nextMaintenanceDueHours,
      remainingHours: due.remainingHours,
      remainingDays: due.remainingDays,
      maintenanceStatus: due.status,
      maintenanceDueLabel: due.dueLabel,
      maintenanceDueColor: due.dueColor,

      compliancePercent: compliance.compliancePercent,
      completedStageCount: compliance.completedStageCount,
      expectedStageCount: compliance.expectedStageCount,

      lastCompletedOnSchedule,
      incompleteMaintenancePhotos,
      missingGps,

      // Also usable as the "owner" fallback source if MQR has none - see
      // vehicle/service.ts's merge order.
      ownerName: latestMaintenance?.customer_name ?? null,
      ownerPhone: latestMaintenance?.customer_phone ?? null,
    };
  }
}
