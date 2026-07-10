import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// lib/email.ts pulls in exportPdf.tsx (react-pdf JSX) at module scope,
// which Vitest's transform can't parse for this test file's dependency
// graph - mocked out, same pattern login/route.test.ts already uses.
vi.mock('../exportPdf', () => ({ renderRecordPdf: vi.fn() }));

const mockSend = vi.fn();
vi.mock('resend', () => ({
  // Must be a real function (not an arrow function) so `new Resend(...)`
  // works - arrow functions have no [[Construct]] and vitest/JS would
  // throw "is not a constructor" otherwise.
  Resend: vi.fn().mockImplementation(function Resend() {
    return { emails: { send: mockSend } };
  }),
}));

const mockLogAuthEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('../authServices/auditService', () => ({
  logAuthEvent: mockLogAuthEvent,
}));

describe('sendAuthEmail (via sendPasswordResetEmail) — v3.0.1 reliability patch', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    mockSend.mockReset();
    mockLogAuthEvent.mockClear();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
  });

  it('Issue 3: reports NOT_CONFIGURED (and records the failure) when RESEND_API_KEY is unset, instead of silently no-oping', async () => {
    delete process.env.RESEND_API_KEY;
    const { sendPasswordResetEmail } = await import('../email');

    const result = await sendPasswordResetEmail('user@example.com', 'https://x/reset?token=t', 'user-1');

    expect(result.ok).toBe(false);
    expect(result.configured).toBe(false);
    expect(result.errorCode).toBe('NOT_CONFIGURED');
    expect(mockSend).not.toHaveBeenCalled();
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      'EMAIL_SEND_FAILURE',
      expect.objectContaining({ userId: 'user-1', metadata: expect.objectContaining({ kind: 'password_reset', ok: false }) })
    );
  });

  it('Issue 2: a provider error that resolves (never throws) is detected, not mistaken for success - this is the exact bug class the production incident traced back to', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockResolvedValue({
      data: null,
      error: { name: 'invalid_from_address', message: 'from address is not verified', statusCode: 422 },
    });
    const { sendPasswordResetEmail } = await import('../email');

    const result = await sendPasswordResetEmail('user@example.com', 'https://x/reset?token=t', 'user-1');

    expect(result.ok).toBe(false);
    expect(result.configured).toBe(true);
    expect(result.errorCode).toBe('invalid_from_address');
    expect(result.errorMessage).toBe('from address is not verified');
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      'EMAIL_SEND_FAILURE',
      expect.objectContaining({ metadata: expect.objectContaining({ errorCode: 'invalid_from_address' }) })
    );
  });

  it('records success and the provider message id when the provider actually accepts the send', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockResolvedValue({ data: { id: 'msg-123' }, error: null });
    const { sendPasswordResetEmail } = await import('../email');

    const result = await sendPasswordResetEmail('user@example.com', 'https://x/reset?token=t', 'user-1');

    expect(result.ok).toBe(true);
    expect(result.messageId).toBe('msg-123');
    expect(mockLogAuthEvent).toHaveBeenCalledWith('EMAIL_SEND_SUCCESS', expect.objectContaining({ userId: 'user-1' }));
  });

  it('Issue 2: treats an unresponsive provider as a timeout rather than hanging the caller forever', async () => {
    vi.useFakeTimers();
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockReturnValue(new Promise(() => {})); // never resolves
    const { sendPasswordResetEmail } = await import('../email');

    const pending = sendPasswordResetEmail('user@example.com', 'https://x/reset?token=t', 'user-1');
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;

    expect(result.ok).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it('never throws even when the provider call itself rejects', async () => {
    process.env.RESEND_API_KEY = 're_test_key';
    mockSend.mockRejectedValue(new Error('network error'));
    const { sendPasswordResetEmail } = await import('../email');

    const result = await sendPasswordResetEmail('user@example.com', 'https://x/reset?token=t', 'user-1');

    expect(result.ok).toBe(false);
    expect(result.errorMessage).toBe('network error');
  });
});
