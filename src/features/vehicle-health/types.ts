/**
 * Vehicle Health Engine — shared types (Phase 5b, reusable Platform Service).
 *
 * A deterministic, rule-based scoring engine - explicitly NOT AI - that
 * gives service teams a quick prioritization signal and structured input
 * for future intelligence features. Thresholds/weights are named constants
 * in `service.ts`, never hardcoded inline in a UI component, so they can be
 * made admin-configurable later without touching call sites.
 */
import { MaintenanceDueStatus } from '@/features/maintenance-due/types';

export type HealthStatus = 'excellent' | 'good' | 'attention' | 'critical';

export interface VehicleHealthInput {
  maintenanceStatus: MaintenanceDueStatus;
  /** From `MaintenanceDueService` - null when there's no maintenance
   *  history yet (no bonus, no penalty). */
  lastCompletedOnSchedule: boolean | null;
  openMqrCount: number;
  /** 2+ MQR opened for this vehicle within the configured lookback window
   *  (see `REPEATED_MQR_WINDOW_DAYS` in service.ts). */
  repeatedMqrWithinPeriod: boolean;
  /** Always 0 today - no Campaign module exists yet in this codebase (see
   *  PROJECT_STATE.md); wired for when one does. */
  pendingCampaignCount: number;
  /** Any of the 3 required maintenance photos missing on the latest visit.
   *  Effectively unreachable via the current PM Record form (all 3 are
   *  required at creation) - kept for defensive correctness/future forms. */
  incompleteMaintenancePhotos: boolean;
  missingGps: boolean;
}

export interface VehicleHealthResult {
  score: number;
  status: HealthStatus;
}
