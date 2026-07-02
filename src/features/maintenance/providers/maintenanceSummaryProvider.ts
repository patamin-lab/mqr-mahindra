/**
 * MaintenanceSummaryProvider — this module's contribution to Vehicle 360.
 *
 * Implements `VehicleSummaryProvider` (owned by `vehicle/types.ts`) so
 * Vehicle 360 never needs to import anything from this module directly.
 * Resolves Product Family, loads the assigned Maintenance Program, loads
 * this vehicle's maintenance history, and delegates all business-rule
 * computation to `MaintenanceDueService` - this file is orchestration only.
 */
import { getProductFamilyIdForModel, getProductFamily, listMaintenanceProgramStagesForFamily } from '@/lib/db';
import { SessionUser } from '@/lib/types';
import { MaintenanceDueService } from '@/features/maintenance-due/service';
import { MaintenanceHistoryEntry, MaintenanceProgramStage } from '@/features/maintenance-due/types';
import { VehicleSummary, VehicleSummaryProvider } from '@/features/vehicle/types';
import { fetchMaintenanceHistoryForSerial } from '../utils/fetchMaintenanceHistory';

const maintenanceDueService = new MaintenanceDueService();

export class MaintenanceSummaryProvider implements VehicleSummaryProvider {
  async getVehicleSummary(serial: string, session: SessionUser): Promise<Partial<VehicleSummary> | null> {
    const records = await fetchMaintenanceHistoryForSerial(serial, session);
    // A vehicle with no model known yet (shouldn't normally happen, since
    // callers only reach this after resolving the vehicle itself) has no
    // Product Family to resolve against - contribute nothing rather than
    // guessing.
    const model = records[0]?.model ?? null;

    const productFamilyId = model ? await getProductFamilyIdForModel(model) : null;
    const [productFamily, stages] = await Promise.all([
      productFamilyId ? getProductFamily(productFamilyId) : Promise.resolve(null),
      productFamilyId ? listMaintenanceProgramStagesForFamily(productFamilyId) : Promise.resolve([]),
    ]);

    const latestMaintenance = records[0] ?? null;
    const history: MaintenanceHistoryEntry[] = records
      .filter((r) => r.performed_date)
      .map((r) => ({ performedDate: r.performed_date as string, hourMeter: r.hour_meter, pmIntervalId: r.pm_interval_id }));
    const dueStages: MaintenanceProgramStage[] = stages.map((s) => ({
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
