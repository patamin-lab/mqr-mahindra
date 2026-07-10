import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFindUserByUsernameOrEmail = vi.fn();
vi.mock('@/lib/db', () => ({
  findUserByUsernameOrEmail: mockFindUserByUsernameOrEmail,
}));

const mockGenerateResetToken = vi.fn().mockResolvedValue('raw-token');
vi.mock('@/lib/authServices/passwordResetService', () => ({
  generateResetToken: mockGenerateResetToken,
}));

const mockSendPasswordResetEmail = vi.fn();
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}));

const mockLogAuthEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/authServices/auditService', () => ({
  logAuthEvent: mockLogAuthEvent,
}));

vi.mock('@/lib/authServices/sessionService', () => ({
  clientIpFrom: () => '1.2.3.4',
}));

const mockIsRateLimited = vi.fn().mockResolvedValue(false);
vi.mock('@/lib/authServices/rateLimitService', () => ({
  isRateLimited: mockIsRateLimited,
}));

const { POST } = await import('./route');

function forgotPasswordRequest(identifier: string) {
  return new NextRequest('http://localhost/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
}

describe('POST /api/auth/forgot-password — v3.0.1 reliability patch', () => {
  beforeEach(() => {
    mockFindUserByUsernameOrEmail.mockReset();
    mockGenerateResetToken.mockClear();
    mockSendPasswordResetEmail.mockReset();
    mockSendPasswordResetEmail.mockResolvedValue({ ok: true, provider: 'resend', configured: true, durationMs: 5 });
    mockLogAuthEvent.mockClear();
    mockIsRateLimited.mockClear();
    mockIsRateLimited.mockResolvedValue(false);
  });

  it('Issue 6: logs a PASSWORD_RESET_REQUEST audit record even when no user matches - previously this could be silently lost', async () => {
    mockFindUserByUsernameOrEmail.mockResolvedValue(null);

    const res = await POST(forgotPasswordRequest('nobody'));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      'PASSWORD_RESET_REQUEST',
      expect.objectContaining({ username: null, userId: null, metadata: { eligible: false } })
    );
    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('Issue 6: logs an audit record even for an empty identifier - previously the whole block (including the log) was skipped', async () => {
    const res = await POST(forgotPasswordRequest(''));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(mockLogAuthEvent).toHaveBeenCalledWith('PASSWORD_RESET_REQUEST', expect.objectContaining({ metadata: { eligible: false } }));
    expect(mockFindUserByUsernameOrEmail).not.toHaveBeenCalled();
  });

  it('Issue 1: awaits the email send before responding - a slow/pending send must not be silently dropped', async () => {
    mockFindUserByUsernameOrEmail.mockResolvedValue({ id: 'u1', username: 'patamin', email: 'patamin@example.com', active: true });
    let sendCompleted = false;
    mockSendPasswordResetEmail.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            sendCompleted = true;
            resolve({ ok: true, provider: 'resend', configured: true, durationMs: 5 });
          }, 5)
        )
    );

    const res = await POST(forgotPasswordRequest('patamin'));
    await res.json();

    // If the route had returned before the send settled (the original
    // fire-and-forget bug), this would be false at this point.
    expect(sendCompleted).toBe(true);
    expect(mockGenerateResetToken).toHaveBeenCalledWith('u1');
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      'PASSWORD_RESET_REQUEST',
      expect.objectContaining({ username: 'patamin', userId: 'u1', metadata: { eligible: true } })
    );
  });

  it('does not attempt a send for a matched user with no email on file (ineligible)', async () => {
    mockFindUserByUsernameOrEmail.mockResolvedValue({ id: 'u2', username: 'ktv.head', email: null, active: true });

    await POST(forgotPasswordRequest('ktv.head'));

    expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      'PASSWORD_RESET_REQUEST',
      expect.objectContaining({ username: 'ktv.head', metadata: { eligible: false } })
    );
  });

  it('Issue 6: still logs an audit record on an unexpected error, and still returns the generic success shape', async () => {
    mockFindUserByUsernameOrEmail.mockRejectedValue(new Error('db unreachable'));

    const res = await POST(forgotPasswordRequest('patamin'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(mockLogAuthEvent).toHaveBeenCalledWith(
      'PASSWORD_RESET_REQUEST',
      expect.objectContaining({ metadata: { eligible: false, error: true } })
    );
  });

  it('returns 429 and never looks up the user when the requesting IP is rate-limited', async () => {
    mockIsRateLimited.mockResolvedValue(true);

    const res = await POST(forgotPasswordRequest('anyone'));

    expect(res.status).toBe(429);
    expect(mockFindUserByUsernameOrEmail).not.toHaveBeenCalled();
  });
});
