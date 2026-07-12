import { describe, it, expect } from 'vitest';
import { InFileDuplicateTracker, buildCompositeKey } from '../DuplicateDetector';

describe('InFileDuplicateTracker', () => {
  it('reports the first row a key was seen on when it recurs', () => {
    const tracker = new InFileDuplicateTracker();
    expect(tracker.check('ABC123', 1)).toEqual({ isDuplicate: false });
    const second = tracker.check('abc123', 5); // case-insensitive match
    expect(second.isDuplicate).toBe(true);
    expect(second.firstSeenAtRow).toBe(1);
    expect(second.reason).toContain('row 1');
  });

  it('never flags a blank value as a duplicate', () => {
    const tracker = new InFileDuplicateTracker();
    expect(tracker.check('', 1)).toEqual({ isDuplicate: false });
    expect(tracker.check('   ', 2)).toEqual({ isDuplicate: false });
  });

  it('tracks composite keys - two rows only collide when every part matches', () => {
    const tracker = new InFileDuplicateTracker();
    tracker.checkComposite(['DEALER_A', 'SN-001'], 1);
    const differentDealer = tracker.checkComposite(['DEALER_B', 'SN-001'], 2);
    expect(differentDealer.isDuplicate).toBe(false);
    const sameComposite = tracker.checkComposite(['DEALER_A', 'SN-001'], 3);
    expect(sameComposite.isDuplicate).toBe(true);
    expect(sameComposite.firstSeenAtRow).toBe(1);
  });

  it('buildCompositeKey treats null/undefined/empty-string parts identically', () => {
    expect(buildCompositeKey(['A', null])).toBe(buildCompositeKey(['A', undefined]));
    expect(buildCompositeKey(['A', null])).toBe(buildCompositeKey(['A', '']));
    expect(buildCompositeKey(['A', 'B'])).not.toBe(buildCompositeKey(['A', 'B', '']));
  });

  it('supports a custom normalizer', () => {
    const tracker = new InFileDuplicateTracker((v) => v.replace(/-/g, '').toLowerCase());
    tracker.check('SN-001', 1);
    const result = tracker.check('sn001', 2);
    expect(result.isDuplicate).toBe(true);
  });

  it('peek()/recordSeen() split lets a caller defer recording until a row is confirmed valid', () => {
    const tracker = new InFileDuplicateTracker();
    // Row 1 has serial "X" but the caller decides NOT to record it
    // (e.g. it failed an unrelated check) - peek() never records.
    expect(tracker.peek('X').isDuplicate).toBe(false);
    // Row 2 also has serial "X" - since row 1 was never recorded, this
    // must NOT be flagged as a duplicate.
    expect(tracker.peek('X').isDuplicate).toBe(false);
    tracker.recordSeen('X', 2);
    // Row 3, same serial - now it IS a duplicate, of row 2 (not row 1).
    const third = tracker.peek('X');
    expect(third.isDuplicate).toBe(true);
    expect(third.firstSeenAtRow).toBe(2);
  });
});
