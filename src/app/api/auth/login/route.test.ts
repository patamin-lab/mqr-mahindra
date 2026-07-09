import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockFindUserByUsername = vi.fn();
const mockInsertLoginLog = vi.fn();
const mockUpgradePasswordHash = vi.fn().mockResolvedValue(undefined);
const mockRecordFailedLogin = vi.fn().mockResolvedValue({ isLocked: false, lockedUntil: null });
const mockResetFailedLogins = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/db', () => ({
  findUserByUsername: mockFindUserByUsername,
  insertLoginLog: mockInsertLoginLog,
  upgradePasswordHash: mockUpgradePasswordHash,
  checkLockStatus: () => ({ isLocked: false, lockedUntil: null }),
  recordFailedLogin: mockRecordFailedLogin,
  resetFailedLogins: mockResetFailedLogins,
  LOCKOUT_MINUTES: 15,
}));

const mockSignSession = vi.fn().mockResolvedValue('signed-token');
vi.mock('@/lib/auth', () => ({
  sha256Hex: vi.fn().mockResolvedValue('HASHED'),
  signSession: mockSignSession,
  SESSION_COOKIE: 'mqr_session',
  SESSION_MINUTES: 180,
}));

const mockCreateSession = vi.fn().mockResolvedValue({ sessionId: 'test-session', expiresAt: new Date().toISOString() });
vi.mock('@/lib/authServices/sessionService', () => ({
  createSession: mockCreateSession,
  clientIpFrom: () => '127.0.0.1',
}));

vi.mock('@/lib/authServices/auditService', () => ({
  logAuthEvent: vi.fn().mockResolvedValue(undefined),
}));

// lib/email.ts pulls in exportPdf.tsx (react-pdf JSX) at module scope,
// which the Vitest/Vite transform for this .ts test can't parse - mocked
// out entirely rather than letting it load for real, same as every other
// sibling module this route imports.
vi.mock('@/lib/email', () => ({
  sendAccountLockedEmail: vi.fn().mockResolvedValue(undefined),
}));

const { POST } = await import('./route');

function loginRequest(username: string, password: string) {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

describe('POST /api/auth/login — branchId population', () => {
  beforeEach(() => {
    mockFindUserByUsername.mockReset();
    mockInsertLoginLog.mockReset();
    mockSignSession.mockClear();
    mockCreateSession.mockClear();
    mockUpgradePasswordHash.mockClear();
    mockRecordFailedLogin.mockClear();
    mockResetFailedLogins.mockClear();
  });

  it('populates sessionUser.branchId from the user row\'s branch_id', async () => {
    mockFindUserByUsername.mockResolvedValue({
      username: 'pong6',
      password_hash: 'HASHED',
      full_name: 'Pong',
      role: 'DealerUser',
      dealer_id: 'KTV',
      branch: 'หนองบัวลำภู',
      branch_id: 'branch-uuid-1',
      active: true,
    });

    const res = await POST(loginRequest('pong6', 'whatever'));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.user.branchId).toBe('branch-uuid-1');
    expect(mockSignSession).toHaveBeenCalledWith(expect.objectContaining({ branchId: 'branch-uuid-1' }));
  });

  it('resolves to null (not an error) when the user has no branch_id assigned yet', async () => {
    mockFindUserByUsername.mockResolvedValue({
      username: 'cust.kpn',
      password_hash: 'HASHED',
      full_name: 'Customer KPN',
      role: 'DealerUser',
      dealer_id: 'KTV',
      branch: 'ขอนแก่น',
      branch_id: null,
      active: true,
    });

    const res = await POST(loginRequest('cust.kpn', 'whatever'));
    const json = await res.json();

    expect(json.ok).toBe(true);
    expect(json.user.branchId).toBeNull();
  });
});
