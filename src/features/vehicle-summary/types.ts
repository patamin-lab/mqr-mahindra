/**
 * VehicleSummaryService — shared types (Phase 5b, reusable Platform Service).
 *
 * Aggregates maintenance and quality summaries for Vehicle 360 - reads
 * through other modules' own services/data-access, never duplicates their
 * records, and never computes Due/Health/Compliance business rules itself
 * (those live in `MaintenanceDueService`/`VehicleHealthService`).
 */
import { MaintenanceDueColor, MaintenanceDueStatus } from '@/features/maintenance-due/types';
import { HealthStatus } from '@/features/vehicle-health/types';

export type VehicleOperationalStatus = 'normal' | 'open_job';

export interface MaintenanceProgramStageSummary {
  label: string;
  intervalHours: number | null;
  intervalMonths: number | null;
}

export interface VehicleSummary {
  serial: string;
  model: string | null;
  engineNumber: string | null;
  retailDate: string | null;
  dealerId: string | null;
  dealerName: string | null;
  branchName: string | null;
  ownerName: string | null;
  ownerPhone: string | null;

  productFamilyId: string | null;
  productFamilyName: string | null;
  /** The Product Family's assigned Maintenance Program, for display only -
   *  e.g. "50 Hr / 250 Hr / 500 Hr / 1000 Hr". */
  maintenanceProgramStages: MaintenanceProgramStageSummary[];

  currentHourMeter: number | null;
  lastMaintenanceDate: string | null;
  nextMaintenanceLabel: string | null;
  nextMaintenanceDueDate: string | null;
  nextMaintenanceDueHours: number | null;
  remainingHours: number | null;
  remainingDays: number | null;
  maintenanceStatus: MaintenanceDueStatus;
  maintenanceDueLabel: string;
  maintenanceDueColor: MaintenanceDueColor;

  healthScore: number;
  healthStatus: HealthStatus;

  compliancePercent: number | null;
  completedStageCount: number;
  expectedStageCount: number;

  openMqrCount: number;
  /** Always 0 today - no Campaign module exists yet (see PROJECT_STATE.md). */
  pendingCampaignCount: number;
  vehicleStatus: VehicleOperationalStatus;
}
