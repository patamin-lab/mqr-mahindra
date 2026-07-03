/**
 * VehicleHealthService — the Vehicle Health Engine (Phase 5b).
 *
 * Deterministic scoring only - no AI, no ML, no external calls. Pure
 * function of the inputs the caller supplies (`vehicle/service.ts`'s
 * `getVehicleSummary()` assembles them from each module's
 * `VehicleSummaryProvider` contribution) - reusable and
 * trivially testable.
 */
import { HealthStatus, VehicleHealthInput, VehicleHealthResult } from './types';

/** Lookback window for the "repeated MQR" scoring rule - the spec leaves
 *  this "configurable" without naming a default; documented here as a
 *  single, easily-changed constant rather than hardcoded in the caller. */
export const REPEATED_MQR_WINDOW_DAYS = 90;

/** Health Score thresholds - "must be configurable later," so this lives
 *  as a named constant in the service layer, never inline in a UI
 *  component. */
export const HEALTH_STATUS_THRESHOLDS: Record<HealthStatus, number> = {
  excellent: 90,
  good: 70,
  attention: 50,
  critical: 0,
};

const SCORE_RULES = {
  completedOnSchedule: 30,
  noOverdueMaintenance: 20,
  noOpenMqr: 20,
  noPendingCampaign: 10,
  latestMaintenanceWithinInterval: 10,
  noRepeatedMqr: 10,
  overdueMaintenancePenalty: -20,
  perOpenMqrPenalty: -10,
  repeatedMqrPenalty: -15,
  perPendingCampaignPenalty: -10,
  incompletePhotosPenalty: -5,
  missingGpsPenalty: -5,
} as const;

function statusForScore(score: number): HealthStatus {
  if (score >= HEALTH_STATUS_THRESHOLDS.excellent) return 'excellent';
  if (score >= HEALTH_STATUS_THRESHOLDS.good) return 'good';
  if (score >= HEALTH_STATUS_THRESHOLDS.attention) return 'attention';
  return 'critical';
}

export class VehicleHealthService {
  calculate(input: VehicleHealthInput): VehicleHealthResult {
    const isOverdue = input.maintenanceStatus === 'overdue';

    let score = 0;
    if (input.lastCompletedOnSchedule) score += SCORE_RULES.completedOnSchedule;
    if (!isOverdue) score += SCORE_RULES.noOverdueMaintenance;
    if (input.openMqrCount === 0) score += SCORE_RULES.noOpenMqr;
    if (input.pendingCampaignCount === 0) score += SCORE_RULES.noPendingCampaign;
    if (input.maintenanceStatus === 'normal') score += SCORE_RULES.latestMaintenanceWithinInterval;
    if (!input.repeatedMqrWithinPeriod) score += SCORE_RULES.noRepeatedMqr;

    if (isOverdue) score += SCORE_RULES.overdueMaintenancePenalty;
    score += input.openMqrCount * SCORE_RULES.perOpenMqrPenalty;
    if (input.repeatedMqrWithinPeriod) score += SCORE_RULES.repeatedMqrPenalty;
    score += input.pendingCampaignCount * SCORE_RULES.perPendingCampaignPenalty;
    if (input.incompleteMaintenancePhotos) score += SCORE_RULES.incompletePhotosPenalty;
    if (input.missingGps) score += SCORE_RULES.missingGpsPenalty;

    const clamped = Math.max(0, Math.min(100, score));
    return { score: clamped, status: statusForScore(clamped) };
  }
}
