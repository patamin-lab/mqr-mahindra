import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockGetDelivery = vi.fn();
const mockLinkNtr = vi.fn();
vi.mock('@/features/delivery', () => ({
  DeliveryService: vi.fn().mockImplementation(function () {
    return {
      getDelivery: mockGetDelivery,
      linkNtr: mockLinkNtr,
    };
  }),
}));

const mockGetById = vi.fn();
vi.mock('@/features/ntr/factory', () => ({
  createNtrService: () => ({ getById: mockGetById }),
}));

const { getSession } = await import('@/lib/auth');
const { POST } = await import('./route');

function session(overrides: Record<string, unknown> = {}) {
  return {
    username: 'alice',
    fullName: 'Alice',
    role: 'DealerUser' as const,
    dealerId: 'D1',
    branch: null,
    branchId: 'B1',
    sessionId: 'test-session',
    forcePasswordChange: false,
    ...overrides,
  };
}

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/delivery-records/del-1/link-ntr', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = { params: { id: 'del-1' } };

describe('POST /api/delivery-records/[id]/link-ntr', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockGetDelivery.mockReset();
    mockLinkNtr.mockReset();
    mockGetById.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await POST(postRequest({ ntrId: 'ntr-1' }), params);
    expect(res.status).toBe(401);
  });

  it('returns 403 for a cross-dealer session (IDOR guard)', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D2' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1', serial: 'SN-1' });
    mockGetById.mockResolvedValue({ id: 'ntr-1', serial: 'SN-1' });

    const res = await POST(postRequest({ ntrId: 'ntr-1' }), params);
    expect(res.status).toBe(403);
    expect(mockLinkNtr).not.toHaveBeenCalled();
  });

  it('rejects an NTR record for a different serial', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1', serial: 'SN-1' });
    mockGetById.mockResolvedValue({ id: 'ntr-1', serial: 'SN-OTHER' });

    const res = await POST(postRequest({ ntrId: 'ntr-1' }), params);
    expect(res.status).toBe(400);
    expect(mockLinkNtr).not.toHaveBeenCalled();
  });

  it('links a matching NTR record', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1', serial: 'SN-1' });
    mockGetById.mockResolvedValue({ id: 'ntr-1', serial: 'SN-1' });
    mockLinkNtr.mockResolvedValue({ id: 'del-1', stage: 'OperatorTraining' });

    const res = await POST(postRequest({ ntrId: 'ntr-1' }), params);
    expect(res.status).toBe(200);
    expect(mockLinkNtr).toHaveBeenCalledWith('del-1', 'ntr-1', expect.anything());
  });
});
