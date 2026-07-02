/**
 * MaintenanceDueService — the Maintenance Due Engine (Phase 5b).
 *
 * Pure calculator: resolves current maintenance stage, next maintenance due
 * (hour-based, month-based, or combined), remaining hours/days, status, and
 * Maintenance Compliance from the Maintenance Program stages + maintenance
 * history the caller supplies. Never touches Supabase, never resolves
 * Product Family itself (that's `MaintenanceSummaryProvider`'s job) - keeps this
 * service a pure, easily-testable calculator, reusable by any future
 * consumer (Dashboard, telematics-driven recalculation, etc.).
 */
import {
  MaintenanceComplianceResult,
  MaintenanceDueColor,
  MaintenanceDueInput,
  MaintenanceDueResult,
  MaintenanceDueStatus,
  MaintenanceEvaluation,
  MaintenanceHistoryEntry,
  MaintenanceProgramStage,
} from './types';

const DUE_SOON_DAYS_WINDOW = 30;
const DUE_SOON_HOURS_MIN_WINDOW = 10;
const DUE_SOON_HOURS_FRACTION = 0.1;

function addMonths(dateIso: string, months: number): string {
  const d = new Date(dateIso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.round(ms / 86400000);
}

/** Ascending by hour threshold (nulls last), tie-broken by month threshold
 *  (nulls last) - the canonical stage ordering used everywhere below. */
function sortStages(stages: MaintenanceProgramStage[]): MaintenanceProgramStage[] {
  return [...stages].sort((a, b) => {
    const ah = a.intervalHours ?? Number.MAX_SAFE_INTEGER;
    const bh = b.intervalHours ?? Number.MAX_SAFE_INTEGER;
    if (ah !== bh) return ah - bh;
    const am = a.intervalMonths ?? Number.MAX_SAFE_INTEGER;
    const bm = b.intervalMonths ?? Number.MAX_SAFE_INTEGER;
    return am - bm;
  });
}

interface ResolvedStage {
  stage: MaintenanceProgramStage | null;
  label: string | null;
  dueHours: number | null;
  dueDate: string | null;
  /** true when this stage was extrapolated past the program's explicit
   *  milestones (repeating the last configured gap), rather than an
   *  explicitly-configured stage. */
  extrapolated: boolean;
}

export class MaintenanceDueService {
  evaluate(input: MaintenanceDueInput): MaintenanceEvaluation {
    const history = [...input.history].sort((a, b) => (a.performedDate < b.performedDate ? -1 : a.performedDate > b.performedDate ? 1 : 0));
    const last = history[history.length - 1] ?? null;

    const compliance = this.calculateCompliance(input.stages, history);
    const due = this.calculateDue(input, history, last);
    const lastCompletedOnSchedule = last ? due.status !== 'overdue' : null;

    return { due, compliance, lastCompletedOnSchedule };
  }

  private calculateCompliance(stages: MaintenanceProgramStage[], history: MaintenanceHistoryEntry[]): MaintenanceComplianceResult {
    if (stages.length === 0) {
      return { expectedStageCount: 0, completedStageCount: 0, compliancePercent: null };
    }
    const completedIds = new Set(history.map((h) => h.pmIntervalId).filter((id): id is string => !!id));
    const completedStageCount = stages.filter((s) => completedIds.has(s.pmIntervalId)).length;
    return {
      expectedStageCount: stages.length,
      completedStageCount,
      compliancePercent: Math.round((completedStageCount / stages.length) * 100),
    };
  }

  /** Resolves the "current maintenance stage" / "next maintenance due" as a
   *  single stage carrying both an hour threshold and a month threshold
   *  when the program defines a combined rule for it. Once every explicit
   *  stage is completed, repeats the gap between the last two configured
   *  stages indefinitely (confirmed default - see PROJECT_STATE.md), rather
   *  than leaving the vehicle permanently without a schedule. */
  private resolveNextStage(
    stages: MaintenanceProgramStage[],
    history: MaintenanceHistoryEntry[],
    lastMaintenanceDate: string | null,
    lastMaintenanceHourMeter: number | null
  ): ResolvedStage {
    if (stages.length === 0) {
      return { stage: null, label: null, dueHours: null, dueDate: null, extrapolated: false };
    }
    const sorted = sortStages(stages);
    const completedIds = new Set(history.map((h) => h.pmIntervalId).filter((id): id is string => !!id));
    const nextStage = sorted.find((s) => !completedIds.has(s.pmIntervalId));

    if (nextStage) {
      const dueDate = nextStage.intervalMonths != null && lastMaintenanceDate ? addMonths(lastMaintenanceDate, nextStage.intervalMonths) : null;
      return { stage: nextStage, label: nextStage.label, dueHours: nextStage.intervalHours, dueDate, extrapolated: false };
    }

    // Every configured stage is already completed - extrapolate by
    // repeating the gap between the last two stages (or the last stage's
    // own value, when there's only one) for both hours and months
    // independently, since a program may define hours only, months only,
    // or both on its final stage. Anchored on the ACTUAL last-serviced
    // hour meter/date (not the nominal stage threshold, and not a
    // forward-search past the current reading) so a vehicle that goes
    // unserviced past a repeat cycle correctly shows Overdue instead of
    // always silently projecting the next still-future cycle.
    const lastStage = sorted[sorted.length - 1];
    const hourStages = sorted.filter((s) => s.intervalHours != null);
    const monthStages = sorted.filter((s) => s.intervalMonths != null);

    let dueHours: number | null = null;
    if (lastStage.intervalHours != null) {
      const gap =
        hourStages.length >= 2
          ? hourStages[hourStages.length - 1].intervalHours! - hourStages[hourStages.length - 2].intervalHours!
          : lastStage.intervalHours;
      const safeGap = gap && gap > 0 ? gap : lastStage.intervalHours!;
      const hourBaseline = lastMaintenanceHourMeter ?? lastStage.intervalHours;
      dueHours = hourBaseline + safeGap;
    }

    let dueDate: string | null = null;
    if (lastStage.intervalMonths != null && lastMaintenanceDate) {
      const gap =
        monthStages.length >= 2
          ? monthStages[monthStages.length - 1].intervalMonths! - monthStages[monthStages.length - 2].intervalMonths!
          : lastStage.intervalMonths;
      const safeGap = gap && gap > 0 ? gap : lastStage.intervalMonths!;
      dueDate = addMonths(lastMaintenanceDate, safeGap);
    }

    return { stage: lastStage, label: lastStage.label, dueHours, dueDate, extrapolated: true };
  }

  private calculateDue(input: MaintenanceDueInput, history: MaintenanceHistoryEntry[], last: MaintenanceHistoryEntry | null): MaintenanceDueResult {
    const lastMaintenanceDate = last?.performedDate ?? null;
    const lastMaintenanceHourMeter = last?.hourMeter ?? null;

    const resolved = this.resolveNextStage(input.stages, history, lastMaintenanceDate, lastMaintenanceHourMeter);

    const remainingHours = resolved.dueHours != null && input.currentHourMeter != null ? resolved.dueHours - input.currentHourMeter : null;
    const remainingDays = resolved.dueDate != null ? daysBetween(input.currentDate, resolved.dueDate) : null;

    let status: MaintenanceDueStatus = 'none';
    if (remainingHours != null || remainingDays != null) {
      const hourGapForDueSoon =
        resolved.stage?.intervalHours != null
          ? Math.max(DUE_SOON_HOURS_MIN_WINDOW, Math.round(resolved.stage.intervalHours * DUE_SOON_HOURS_FRACTION))
          : DUE_SOON_HOURS_MIN_WINDOW;

      const overdue = (remainingHours != null && remainingHours < 0) || (remainingDays != null && remainingDays < 0);
      const dueSoon =
        !overdue &&
        ((remainingHours != null && remainingHours <= hourGapForDueSoon) || (remainingDays != null && remainingDays <= DUE_SOON_DAYS_WINDOW));

      status = overdue ? 'overdue' : dueSoon ? 'due_soon' : 'normal';
    }

    const dueColor: MaintenanceDueColor = status === 'overdue' ? 'red' : status === 'due_soon' ? 'yellow' : status === 'normal' ? 'green' : 'gray';
    const dueLabel =
      status === 'overdue' ? 'เลยกำหนด' : status === 'due_soon' ? 'ใกล้ถึงกำหนด' : status === 'normal' ? 'ปกติ' : 'ยังไม่มีกำหนด';
    const dueScore = status === 'overdue' ? 0 : status === 'due_soon' ? 50 : status === 'normal' ? 100 : null;

    return {
      lastMaintenanceDate,
      lastMaintenanceHourMeter,
      nextMaintenanceLabel: resolved.label && resolved.extrapolated ? `${resolved.label} (ประมาณ)` : resolved.label,
      nextMaintenanceDueDate: resolved.dueDate,
      nextMaintenanceDueHours: resolved.dueHours,
      remainingHours,
      remainingDays,
      status,
      dueLabel,
      dueColor,
      dueScore,
    };
  }
}
