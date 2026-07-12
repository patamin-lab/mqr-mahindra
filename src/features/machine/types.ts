/**
 * Machine domain — type aliases (ADR-009).
 *
 * "Machine" is the ubiquitous business term platform-wide; nothing here is
 * a new shape. Every type is a straight re-export of the existing
 * `vehicle`/`vehicle-health`/`maintenance-due` type it aliases - see
 * `docs/engineering/MACHINE_DOMAIN.md` for why no `src/features/vehicle/`
 * internals were renamed (facade layer, not a rewrite).
 */
export type { VehicleSummary as MachineSummary, VehicleEvent as MachineEvent, VehicleEventType as MachineEventType, VehicleSummaryProvider as MachineSummaryProvider, VehicleOperationalStatus as MachineOperationalStatus } from '@/features/vehicle/types';
export type { Vehicle as Machine } from '@/lib/types';
export type { VehicleSearchResult as MachineSearchResult } from '@/lib/db';

/**
 * Machine Digital Passport v1.0 - genuinely new shapes (not a re-export of
 * an existing type), since no Warranty or Quality-breakdown summary exists
 * anywhere else in the codebase yet. Both are derived entirely from
 * existing, already-scoped MQR data (`fetchMqrRecords`/`MqrRecord`) - see
 * `MachineService.getMachineWarrantySummary()`/`getMachineQualitySummary()`
 * for the derivation, and `docs/architecture/MACHINE_DATA_OWNERSHIP.md`
 * for why Warranty has no dedicated table of its own yet.
 */
export interface MachineWarrantyClaim {
  jobId: string;
  foundDate: string | null;
  problemSystem: string | null;
  warrantyStatus: string | null;
  recordStatus: string;
}

export interface MachineWarrantySummary {
  /** Overall vehicle-level warranty read (delivery date -> today,
   *  powertrain coverage - the broadest of the two `calcWarranty()`
   *  coverage classes) - `null` when there's no delivery date to compute
   *  from yet (e.g. still in dealer stock, no NTR on file). */
  status: 'อยู่ในประกัน' | 'พ้นประกัน' | 'ไม่ระบุวันที่ส่งมอบ' | null;
  ageMonths: number | null;
  limitMonths: number | null;
  claims: MachineWarrantyClaim[];
}

export interface MachineQualityCase {
  jobId: string;
  status: string;
  severity: string | null;
  foundDate: string | null;
}

export interface MachineQualitySummary {
  openCount: number;
  closedCount: number;
  criticalCount: number;
  cases: MachineQualityCase[];
}

/**
 * Machine Digital Passport v1.1 refinement - Related Records panel. Not a
 * new data source: each record is one of the same MQR/PM/NTR rows already
 * read by `getMachineWarrantySummary()`/`getMachineQualitySummary()`/
 * `getMachineAuditTimeline()`, just surfaced as one flat cross-module list
 * with a link to that record's own detail page - see
 * `MachineService.getMachineRelatedRecords()`.
 */
export interface MachineRelatedRecord {
  module: 'mqr' | 'pm' | 'ntr';
  recordId: string;
  reference: string;
  status: string | null;
  date: string | null;
  href: string;
}
