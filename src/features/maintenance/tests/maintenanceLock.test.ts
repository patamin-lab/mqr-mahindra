import { describe, it, expect } from 'vitest';
import { evaluateMaintenanceLock, touchesLockAffectingFields, MAINTENANCE_EDITABLE_WINDOW_HOURS } from '../utils/maintenanceLock';

const NOW = new Date('2026-06-15T12:00:00.000Z');

function fields(overrides: Partial<{ created_at: string; locked_at: string | null; locked_reason: any; unlocked_until: string | null }> = {}) {
  return {
    created_at: NOW.toISOString(),
    locked_at: null,
    locked_reason: null,
    unlocked_until: null,
    ...overrides,
  };
}

describe('evaluateMaintenanceLock', () => {
  it('is unlocked for a freshly created record', () => {
    const result = evaluateMaintenanceLock(fields(), NOW);
    expect(result).toEqual({ locked: false, reason: null });
  });

  it('is unlocked right at the boundary of the editable window', () => {
    const createdAt = new Date(NOW.getTime() - MAINTENANCE_EDITABLE_WINDOW_HOURS * 60 * 60 * 1000);
    const result = evaluateMaintenanceLock(fields({ created_at: createdAt.toISOString() }), NOW);
    expect(result.locked).toBe(false);
  });

  it('locks with reason edit_window_expired once past the 24h window with no explicit lock', () => {
    const createdAt = new Date(NOW.getTime() - (MAINTENANCE_EDITABLE_WINDOW_HOURS + 1) * 60 * 60 * 1000);
    const result = evaluateMaintenanceLock(fields({ created_at: createdAt.toISOString() }), NOW);
    expect(result).toEqual({ locked: true, reason: 'edit_window_expired' });
  });

  it('locks with reason superseded when explicitly locked, regardless of age', () => {
    const result = evaluateMaintenanceLock(
      fields({ locked_at: NOW.toISOString(), locked_reason: 'superseded' }),
      NOW
    );
    expect(result).toEqual({ locked: true, reason: 'superseded' });
  });

  it('is unlocked while a temporary override window is still active, even on an explicitly locked record', () => {
    const future = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
    const result = evaluateMaintenanceLock(
      fields({ locked_at: NOW.toISOString(), locked_reason: 'superseded', unlocked_until: future }),
      NOW
    );
    expect(result).toEqual({ locked: false, reason: null });
  });

  it('re-locks with reason manual_override once a temporary override window has passed', () => {
    const past = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    const result = evaluateMaintenanceLock(
      fields({ locked_at: NOW.toISOString(), locked_reason: 'superseded', unlocked_until: past }),
      NOW
    );
    expect(result).toEqual({ locked: true, reason: 'manual_override' });
  });

  it('re-locks with reason manual_override (not edit_window_expired) when the override expires past the age window with no explicit lock', () => {
    const createdAt = new Date(NOW.getTime() - (MAINTENANCE_EDITABLE_WINDOW_HOURS + 1) * 60 * 60 * 1000);
    const past = new Date(NOW.getTime() - 60 * 60 * 1000).toISOString();
    const result = evaluateMaintenanceLock(fields({ created_at: createdAt.toISOString(), unlocked_until: past }), NOW);
    expect(result).toEqual({ locked: true, reason: 'manual_override' });
  });
});

describe('touchesLockAffectingFields', () => {
  it('is true when the patch includes hour_meter', () => {
    expect(touchesLockAffectingFields({ hour_meter: 100 })).toBe(true);
  });

  it('is true when the patch includes performed_date, pm_interval_id, or serial', () => {
    expect(touchesLockAffectingFields({ performed_date: '2026-01-01' })).toBe(true);
    expect(touchesLockAffectingFields({ pm_interval_id: 'x' })).toBe(true);
    expect(touchesLockAffectingFields({ serial: 'SN-1' })).toBe(true);
  });

  it('is false for a patch touching only non-calculation fields', () => {
    expect(touchesLockAffectingFields({ notes: 'ok', customer_phone: '081-2345678' })).toBe(false);
  });

  it('is false for an empty patch', () => {
    expect(touchesLockAffectingFields({})).toBe(false);
  });
});
