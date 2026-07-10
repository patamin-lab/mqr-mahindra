import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ensureCompletion } from '../reliability';

describe('ensureCompletion', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('awaits the promise and returns its resolved value', async () => {
    const result = await ensureCompletion(Promise.resolve('done'), { task: 'test' });
    expect(result).toBe('done');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('never throws - a rejection is captured via structured logging and null is returned', async () => {
    const result = await ensureCompletion(Promise.reject(new Error('boom')), { task: 'test', userId: 'u1' });
    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[auth] background task failed',
      expect.objectContaining({ task: 'test', userId: 'u1', error: 'boom' })
    );
  });

  it('guarantees the awaited promise settles before returning - the fix for the production incident where an un-awaited email send/audit write raced against the response', async () => {
    let sideEffectRan = false;
    const slow = new Promise<void>((resolve) =>
      setTimeout(() => {
        sideEffectRan = true;
        resolve();
      }, 10)
    );
    await ensureCompletion(slow, { task: 'slow-task' });
    expect(sideEffectRan).toBe(true);
  });
});
