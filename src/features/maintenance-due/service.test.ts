import { describe, it, expect } from 'vitest';
import { MaintenanceDueService } from './service';
import type { MaintenanceHistoryEntry, MaintenanceProgramStage } from './types';

const service = new MaintenanceDueService();

// OJA Compact-style hour-based program from the spec's example.
const OJA_COMPACT_STAGES: MaintenanceProgramStage[] = [
  { pmIntervalId: 's50', label: '50 Hr', intervalHours: 50, intervalMonths: null },
  { pmIntervalId: 's250', label: '250 Hr', intervalHours: 250, intervalMonths: null },
  { pmIntervalId: 's500', label: '500 Hr', intervalHours: 500, intervalMonths: null },
  { pmIntervalId: 's1000', label: '1000 Hr', intervalHours: 1000, intervalMonths: null },
];

function history(entries: Partial<MaintenanceHistoryEntry>[]): MaintenanceHistoryEntry[] {
  return entries.map((e) => ({ performedDate: '2026-01-01', hourMeter: null, pmIntervalId: null, ...e }));
}

describe('MaintenanceDueService', () => {
  describe('no Maintenance Program configured', () => {
    it('returns status "none" and null compliance', () => {
      const result = service.evaluate({ currentHourMeter: 100, currentDate: '2026-01-01', stages: [], history: [] });

      expect(result.due.status).toBe('none');
      expect(result.due.dueColor).toBe('gray');
      expect(result.compliance).toEqual({ expectedStageCount: 0, completedStageCount: 0, compliancePercent: null });
      expect(result.lastCompletedOnSchedule).toBeNull();
    });
  });

  describe('hour-based program, no history yet', () => {
    it('targets the first stage (50 Hr) and reports Normal well before it', () => {
      const result = service.evaluate({ currentHourMeter: 10, currentDate: '2026-01-01', stages: OJA_COMPACT_STAGES, history: [] });

      expect(result.due.nextMaintenanceLabel).toBe('50 Hr');
      expect(result.due.nextMaintenanceDueHours).toBe(50);
      expect(result.due.remainingHours).toBe(40);
      expect(result.due.status).toBe('normal');
      expect(result.due.dueColor).toBe('green');
      expect(result.compliance).toEqual({ expectedStageCount: 4, completedStageCount: 0, compliancePercent: 0 });
      expect(result.lastCompletedOnSchedule).toBeNull();
    });

    it('reports Due Soon within the 10%-of-interval (min 10hr) window', () => {
      const result = service.evaluate({ currentHourMeter: 45, currentDate: '2026-01-01', stages: OJA_COMPACT_STAGES, history: [] });

      expect(result.due.remainingHours).toBe(5);
      expect(result.due.status).toBe('due_soon');
      expect(result.due.dueColor).toBe('yellow');
    });

    it('reports Overdue once the hour meter passes the stage with no matching record', () => {
      const result = service.evaluate({ currentHourMeter: 60, currentDate: '2026-01-01', stages: OJA_COMPACT_STAGES, history: [] });

      expect(result.due.remainingHours).toBe(-10);
      expect(result.due.status).toBe('overdue');
      expect(result.due.dueColor).toBe('red');
    });
  });

  describe('hour-based program with partial history', () => {
    it('advances to the next uncompleted stage once earlier stages are recorded', () => {
      const result = service.evaluate({
        currentHourMeter: 100,
        currentDate: '2026-01-01',
        stages: OJA_COMPACT_STAGES,
        history: history([{ performedDate: '2025-06-01', hourMeter: 55, pmIntervalId: 's50' }]),
      });

      expect(result.due.nextMaintenanceLabel).toBe('250 Hr');
      expect(result.due.remainingHours).toBe(150);
      expect(result.due.status).toBe('normal');
      expect(result.compliance).toEqual({ expectedStageCount: 4, completedStageCount: 1, compliancePercent: 25 });
      expect(result.lastCompletedOnSchedule).toBe(true);
    });

    it('reports lastCompletedOnSchedule=false when the most recent visit left the vehicle overdue', () => {
      // Only the 50hr stage was ever completed, but the hour meter is now
      // deep past the (still-uncompleted) 250hr stage.
      const result = service.evaluate({
        currentHourMeter: 400,
        currentDate: '2026-01-01',
        stages: OJA_COMPACT_STAGES,
        history: history([{ performedDate: '2025-06-01', hourMeter: 55, pmIntervalId: 's50' }]),
      });

      expect(result.due.status).toBe('overdue');
      expect(result.lastCompletedOnSchedule).toBe(false);
    });
  });

  describe('past the final configured stage - repeats the last gap (confirmed default)', () => {
    it('extrapolates the next threshold as last stage + gap, anchored on the actual last-serviced hour meter', () => {
      const result = service.evaluate({
        currentHourMeter: 1050,
        currentDate: '2026-01-01',
        stages: OJA_COMPACT_STAGES,
        history: history([
          { performedDate: '2025-01-01', hourMeter: 55, pmIntervalId: 's50' },
          { performedDate: '2025-03-01', hourMeter: 260, pmIntervalId: 's250' },
          { performedDate: '2025-06-01', hourMeter: 510, pmIntervalId: 's500' },
          { performedDate: '2025-09-01', hourMeter: 1005, pmIntervalId: 's1000' },
        ]),
      });

      // gap between 500 and 1000 is 500; anchored on the last serviced hour
      // meter (1005), so next due = 1005 + 500 = 1505.
      expect(result.due.nextMaintenanceDueHours).toBe(1505);
      expect(result.due.remainingHours).toBe(455);
      expect(result.due.status).toBe('normal');
      expect(result.due.nextMaintenanceLabel).toContain('ประมาณ');
      expect(result.compliance).toEqual({ expectedStageCount: 4, completedStageCount: 4, compliancePercent: 100 });
    });

    it('can go Overdue in the extrapolated/repeating regime once the hour meter passes the projected threshold', () => {
      const result = service.evaluate({
        currentHourMeter: 1600,
        currentDate: '2026-01-01',
        stages: OJA_COMPACT_STAGES,
        history: history([
          { performedDate: '2025-01-01', hourMeter: 55, pmIntervalId: 's50' },
          { performedDate: '2025-03-01', hourMeter: 260, pmIntervalId: 's250' },
          { performedDate: '2025-06-01', hourMeter: 510, pmIntervalId: 's500' },
          { performedDate: '2025-09-01', hourMeter: 1005, pmIntervalId: 's1000' },
        ]),
      });

      // next due = 1005 + 500 = 1505, current is 1600 -> 95 hours overdue.
      expect(result.due.nextMaintenanceDueHours).toBe(1505);
      expect(result.due.remainingHours).toBe(-95);
      expect(result.due.status).toBe('overdue');
    });

    it('repeats the single stage\'s own interval when only one stage is configured', () => {
      const singleStage: MaintenanceProgramStage[] = [{ pmIntervalId: 's300', label: '300 Hr', intervalHours: 300, intervalMonths: null }];
      const result = service.evaluate({
        currentHourMeter: 320,
        currentDate: '2026-01-01',
        stages: singleStage,
        history: history([{ performedDate: '2025-01-01', hourMeter: 305, pmIntervalId: 's300' }]),
      });

      // only one stage -> gap repeats its own value (300); anchored on last
      // serviced hour meter 305 -> next due = 605.
      expect(result.due.nextMaintenanceDueHours).toBe(605);
      expect(result.due.remainingHours).toBe(285);
      expect(result.due.status).toBe('normal');
    });
  });

  describe('month-based program', () => {
    const monthStages: MaintenanceProgramStage[] = [
      { pmIntervalId: 'm6', label: '6 เดือน', intervalHours: null, intervalMonths: 6 },
      { pmIntervalId: 'm12', label: '12 เดือน', intervalHours: null, intervalMonths: 12 },
    ];

    it('projects the next due date from the last completed visit', () => {
      const result = service.evaluate({
        currentHourMeter: null,
        currentDate: '2026-01-10',
        stages: monthStages,
        history: history([{ performedDate: '2025-07-01', hourMeter: null, pmIntervalId: 'm6' }]),
      });

      expect(result.due.nextMaintenanceLabel).toBe('12 เดือน');
      expect(result.due.nextMaintenanceDueDate).toBe('2026-07-01');
      expect(result.due.status).toBe('normal');
    });

    it('reports Overdue once the current date passes the projected due date', () => {
      const result = service.evaluate({
        currentHourMeter: null,
        currentDate: '2026-08-01',
        stages: monthStages,
        history: history([{ performedDate: '2025-07-01', hourMeter: null, pmIntervalId: 'm6' }]),
      });

      expect(result.due.status).toBe('overdue');
      expect(result.due.remainingDays).toBeLessThan(0);
    });
  });

  describe('combined hour + month rule on the same stage', () => {
    it('flags Overdue when either the hour or the month threshold has passed ("whichever comes first")', () => {
      const combinedStage: MaintenanceProgramStage[] = [
        { pmIntervalId: 'c1', label: '250 Hr / 6 เดือน', intervalHours: 250, intervalMonths: 6 },
      ];

      // Hours look fine (well under 250) but the 6-month window has passed.
      const result = service.evaluate({
        currentHourMeter: 50,
        currentDate: '2026-08-01',
        stages: combinedStage,
        history: history([{ performedDate: '2026-01-01', hourMeter: 10, pmIntervalId: null }]),
      });

      expect(result.due.remainingHours).toBe(200);
      expect(result.due.remainingDays).toBeLessThan(0);
      expect(result.due.status).toBe('overdue');
    });
  });
});
