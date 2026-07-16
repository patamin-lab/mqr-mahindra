import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockGetDelivery = vi.fn();
const mockRecordAcceptance = vi.fn();
vi.mock('@/features/delivery', () => ({
  DeliveryService: vi.fn().mockImplementation(function () {
    return {
      getDelivery: mockGetDelivery,
      recordAcceptance: mockRecordAcceptance,
    };
  }),
}));

const { getSession } = await import('@/lib/auth');
const { POST } = await import('./route');

function session(overrides: Record<string, unknown> = {}) {
  return {
    username: 'admin1',
    fullName: 'Admin One',
    role: 'DealerAdmin' as const,
    dealerId: 'D1',
    branch: null,
    branchId: 'B1',
    sessionId: 'test-session',
    forcePasswordChange: false,
    ...overrides,
  };
}

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/delivery-records/del-1/acceptance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = { params: { id: 'del-1' } };

describe('POST /api/delivery-records/[id]/acceptance', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockGetDelivery.mockReset();
    mockRecordAcceptance.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await POST(postRequest({}), params);
    expect(res.status).toBe(401);
  });

  it('returns 403 for a cross-dealer session (IDOR guard)', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D2' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });

    const res = await POST(postRequest({}), params);
    expect(res.status).toBe(403);
    expect(mockRecordAcceptance).not.toHaveBeenCalled();
  });

  it('surfaces the service\'s own canApproveDelivery rejection (e.g. DealerUser) as 403', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'DealerUser', dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
    mockRecordAcceptance.mockRejectedValue(new Error('Role DealerUser may not record Delivery Acceptance'));

    const res = await POST(postRequest({}), params);
    expect(res.status).toBe(403);
  });

  it('records acceptance for an authorized role in the same dealer', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'DealerAdmin', dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
    mockRecordAcceptance.mockResolvedValue({ id: 'del-1', stage: 'WarrantyActivation' });

    const res = await POST(postRequest({ acceptanceNotes: 'ok' }), params);
    expect(res.status).toBe(200);
    expect(mockRecordAcceptance).toHaveBeenCalledWith('del-1', { acceptanceNotes: 'ok' }, expect.anything());
  });
});
