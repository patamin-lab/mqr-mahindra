/**
 * Maintenance Due Engine — shared types (Phase 5b, reusable Platform Service).
 *
 * "No UI may calculate maintenance due values directly" per spec — every
 * field here is meant to be computed once by `MaintenanceDueService` and
 * simply displayed wherever it's needed (Vehicle 360 today; future
 * Dashboard/Timeline consumers later).
 */

export type MaintenanceDueStatus = 'normal' | 'due_soon' | 'overdue' | 'none';
export type MaintenanceDueColor = 'green' | 'yellow' | 'red' | 'gray';

/** One row of a Product Family's assigned Maintenance Program - a
 *  `pm_intervals` row reached via `maintenance_program_assignments`, never
 *  via a direct Tractor Model lookup. */
export interface MaintenanceProgramStage {
  pmIntervalId: string;
  label: string;
  intervalHours: number | null;
  intervalMonths: number | null;
}

/** One completed maintenance visit for this vehicle (from `pm_records`). */
export interface MaintenanceHistoryEntry {
  performedDate: string;
  hourMeter: number | null;
  pmIntervalId: string | null;
}

export interface MaintenanceDueInput {
  currentHourMeter: number | null;
  currentDate: string;
  /** This vehicle's Product Family's assigned Maintenance Program stages -
   *  resolved by the caller (`MaintenanceSummaryProvider`), never by this
   *  service itself, so it stays a pure calculator. */
  stages: MaintenanceProgramStage[];
  history: MaintenanceHistoryEntry[];
}

export interface MaintenanceDueResult {
  lastMaintenanceDate: string | null;
  lastMaintenanceHourMeter: number | null;
  nextMaintenanceLabel: string | null;
  nextMaintenanceDueDate: string | null;
  nextMaintenanceDueHours: number | null;
  remainingHours: number | null;
  remainingDays: number | null;
  status: MaintenanceDueStatus;
  dueLabel: string;
  dueColor: MaintenanceDueColor;
  /** "due score if available" per spec - a simple 0/50/100 proxy for
   *  urgency, not a substitute for `status` itself. */
  dueScore: number | null;
}

export interface MaintenanceComplianceResult {
  expectedStageCount: number;
  completedStageCount: number;
  /** null when no Maintenance Program is configured for this vehicle's
   *  Product Family yet - compliance is undefined, not 0%. */
  compliancePercent: number | null;
}

export interface MaintenanceEvaluation {
  due: MaintenanceDueResult;
  compliance: MaintenanceComplianceResult;
  /** Feeds Vehicle Health Engine's "completed maintenance on schedule: +30"
   *  rule - true only when at least one maintenance has been completed and
   *  the vehicle isn't currently overdue; null when there's no maintenance
   *  history yet to judge (see service.ts for the documented reasoning). */
  lastCompletedOnSchedule: boolean | null;
}
