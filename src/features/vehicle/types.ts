/**
 * Vehicle 360 / Vehicle Life Cycle — shared types.
 *
 * The Vehicle Life Cycle timeline is an aggregator, not a data owner: it
 * never stores its own copy of a module's records. Each module exposes a
 * `VehicleEventSource` function that reads its own table and maps rows to
 * the common `VehicleEvent` shape; the registry in `registry.ts` is the only
 * place a future module (PDI/NTR/Campaign/Parts Request/...) needs to touch
 * to appear on the timeline — the aggregation/rendering code never changes.
 */
import { SessionUser } from '@/lib/types';
import { MaintenanceDueColor, MaintenanceDueStatus } from '@/features/maintenance-due/types';
import { HealthStatus } from '@/features/vehicle-health/types';

/** Full set of event types the timeline is designed to render, including
 *  future modules that don't exist yet (per spec's "Future Ready" — the
 *  type/icon/label mapping is ready even though only Maintenance/MQR
 *  currently produce real events; see registry.ts). */
export type VehicleEventType =
  | 'FactoryBuild'
  | 'DealerReceive'
  | 'PdiCompleted'
  | 'NtrCompleted'
  | 'MaintenanceCompleted'
  | 'MqrOpened'
  | 'MqrClosed'
  | 'CampaignAssigned'
  | 'CampaignCompleted'
  | 'PartsRequested'
  | 'PartsDelivered'
  | 'Inspection'
  | 'Other';

export const VEHICLE_EVENT_MODULE_LABEL: Record<VehicleEventType, string> = {
  FactoryBuild: 'โรงงาน',
  DealerReceive: 'ดีลเลอร์รับรถ',
  PdiCompleted: 'PDI',
  NtrCompleted: 'NTR',
  MaintenanceCompleted: 'บำรุงรักษา (Maintenance)',
  MqrOpened: 'รายงานปัญหาคุณภาพ (MQR)',
  MqrClosed: 'รายงานปัญหาคุณภาพ (MQR)',
  CampaignAssigned: 'แคมเปญ',
  CampaignCompleted: 'แคมเปญ',
  PartsRequested: 'คำขออะไหล่',
  PartsDelivered: 'คำขออะไหล่',
  Inspection: 'ตรวจสภาพ',
  Other: 'อื่นๆ',
};

/** One row on the Vehicle Life Cycle timeline. `date` is an ISO date/timestamp
 *  string so events from different modules sort correctly together. */
export interface VehicleEvent {
  type: VehicleEventType;
  date: string;
  referenceNumber: string;
  description: string;
  user: string | null;
  status: string | null;
  /** Link back to the originating module's own detail page — the timeline
   *  never renders module data inline beyond this summary row. */
  href: string;
}

/** Contract every module implements to appear on the Vehicle Life Cycle
 *  timeline. Scoping (dealer/branch) must be applied inside the source
 *  itself, exactly like every other module-owned query in this app. */
export type VehicleEventSource = (serial: string, session: SessionUser) => Promise<VehicleEvent[]>;

// ---------- Vehicle Summary Architecture (Architecture Refactoring) ----------
//
// Vehicle 360 is an aggregation layer only - it must never query a business
// module's repository/service directly. Each module instead implements
// `VehicleSummaryProvider`, contributing its own slice of `VehicleSummary`;
// `vehicle/service.ts`'s `getVehicleSummary()` collects every registered
// provider's contribution, merges them, and computes the one genuinely
// cross-module field (Health Score - it needs both Maintenance's and MQR's
// signals) itself. A future module (PDI/NTR/Campaign/Parts Request/...)
// only needs to add its own provider to the registry - Vehicle 360's
// aggregation code never changes.

export type VehicleOperationalStatus = 'normal' | 'open_job';

export interface MaintenanceProgramStageSummary {
  label: string;
  intervalHours: number | null;
  intervalMonths: number | null;
}

/** The full Vehicle 360 summary. Every field is optional on a per-provider
 *  contribution (`Partial<VehicleSummary>`) since no single module owns all
 *  of them - `getVehicleSummary()` is responsible for the final, fully
 *  populated object. */
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

  compliancePercent: number | null;
  completedStageCount: number;
  expectedStageCount: number;

  /** Raw signals feeding Health Score - not meant for direct display, kept
   *  on the summary so `getVehicleSummary()` can compute Health without a
   *  second round-trip to each provider. */
  lastCompletedOnSchedule: boolean | null;
  incompleteMaintenancePhotos: boolean;
  missingGps: boolean;
  repeatedMqrWithinPeriod: boolean;

  healthScore: number;
  healthStatus: HealthStatus;

  openMqrCount: number;
  /** Always 0 today - no Campaign module exists yet (see PROJECT_STATE.md). */
  pendingCampaignCount: number;
  vehicleStatus: VehicleOperationalStatus;
}

/** Contract every business module implements to contribute to Vehicle 360 -
 *  the "MqrSummaryProvider"/"MaintenanceSummaryProvider"/future
 *  "PdiSummaryProvider" etc. from the spec. Returns only the slice of
 *  `VehicleSummary` this module owns; `null` if the module has nothing to
 *  contribute for this vehicle (never throws for "no data"). */
export interface VehicleSummaryProvider {
  getVehicleSummary(serial: string, session: SessionUser): Promise<Partial<VehicleSummary> | null>;
}
