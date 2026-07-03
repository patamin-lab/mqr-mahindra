import { describe, it, expect } from 'vitest';
import { VehicleHealthService } from './service';
import type { VehicleHealthInput } from './types';

const service = new VehicleHealthService();

function baseInput(overrides: Partial<VehicleHealthInput> = {}): VehicleHealthInput {
  return {
    maintenanceStatus: 'normal',
    lastCompletedOnSchedule: true,
    openMqrCount: 0,
    repeatedMqrWithinPeriod: false,
    pendingCampaignCount: 0,
    incompleteMaintenancePhotos: false,
    missingGps: false,
    ...overrides,
  };
}

describe('VehicleHealthService', () => {
  it('awards the full 100 when every positive condition holds and no negatives apply', () => {
    const result = service.calculate(baseInput());

    expect(result.score).toBe(100);
    expect(result.status).toBe('excellent');
  });

  it('clamps at 0 when every penalty applies heavily', () => {
    const result = service.calculate(
      baseInput({
        maintenanceStatus: 'overdue',
        lastCompletedOnSchedule: false,
        openMqrCount: 5,
        repeatedMqrWithinPeriod: true,
        pendingCampaignCount: 3,
        incompleteMaintenancePhotos: true,
        missingGps: true,
      })
    );

    expect(result.score).toBe(0);
    expect(result.status).toBe('critical');
  });

  it('applies the overdue maintenance penalty and withholds the related bonuses', () => {
    const result = service.calculate(baseInput({ maintenanceStatus: 'overdue', lastCompletedOnSchedule: false }));

    // loses: completedOnSchedule(30) + noOverdue(20) + latestWithinInterval(10) = 60 in withheld bonuses
    // plus -20 overdue penalty vs the 100 baseline => 100 - 60 - 20 = 20
    expect(result.score).toBe(20);
    expect(result.status).toBe('critical');
  });

  it('subtracts 10 per open MQR and withholds the "no open MQR" bonus, landing in the "attention" band', () => {
    const result = service.calculate(baseInput({ openMqrCount: 2 }));

    // withholds noOpenMqr(20), then -10 per open MQR (2 => -20) => 100-20-20=60
    expect(result.score).toBe(60);
    expect(result.status).toBe('attention');
  });

  it('applies the repeated-MQR penalty and withholds its bonus', () => {
    const result = service.calculate(baseInput({ repeatedMqrWithinPeriod: true }));

    // withholds noRepeatedMqr(10), applies -15 => 100-10-15=75
    expect(result.score).toBe(75);
    expect(result.status).toBe('good');
  });

  it('applies per-campaign penalty and withholds the "no pending campaign" bonus', () => {
    const result = service.calculate(baseInput({ pendingCampaignCount: 1 }));

    // withholds noPendingCampaign(10), applies -10 per campaign => 100-10-10=80
    expect(result.score).toBe(80);
    expect(result.status).toBe('good');
  });

  it('applies a flat -5 for incomplete photos and -5 for missing GPS independently', () => {
    const result = service.calculate(baseInput({ incompleteMaintenancePhotos: true, missingGps: true }));

    expect(result.score).toBe(90);
    expect(result.status).toBe('excellent');
  });

  it('withholds the "latest maintenance within configured interval" bonus for Due Soon (not just Overdue)', () => {
    const result = service.calculate(baseInput({ maintenanceStatus: 'due_soon' }));

    // still gets noOverdueMaintenance(20) since due_soon isn't overdue, but
    // loses the stricter latestWithinInterval(10) bonus => 100-10=90
    expect(result.score).toBe(90);
    expect(result.status).toBe('excellent');
  });

  it('gives no completedOnSchedule bonus/penalty when there is no maintenance history yet (null)', () => {
    const result = service.calculate(baseInput({ lastCompletedOnSchedule: null }));

    expect(result.score).toBe(70);
    expect(result.status).toBe('good');
  });

});
