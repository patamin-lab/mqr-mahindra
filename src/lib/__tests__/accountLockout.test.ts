import { describe, it, expect } from 'vitest';
import { checkLockStatus } from '../db';

describe('checkLockStatus', () => {
  it('is not locked when locked_until is null', () => {
    expect(checkLockStatus({ locked_until: null })).toEqual({ isLocked: false, lockedUntil: null });
  });

  it('is locked when locked_until is in the future', () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    expect(checkLockStatus({ locked_until: future })).toEqual({ isLocked: true, lockedUntil: future });
  });

  it('is not locked once locked_until has passed - no manual/cron step needed', () => {
    const past = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(checkLockStatus({ locked_until: past })).toEqual({ isLocked: false, lockedUntil: null });
  });
});
