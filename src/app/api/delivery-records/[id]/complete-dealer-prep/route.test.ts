import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockGetDelivery = vi.fn();
const mockCompleteDealerPrep = vi.fn();
vi.mock('@/features/delivery', () => ({
  DeliveryService: vi.fn().mockImplementation(function () {
    return {
      getDelivery: mockGetDelivery,
      completeDealerPrep: mockCompleteDealerPrep,
    };
  }),
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
  return new NextRequest('http://localhost/api/delivery-records/del-1/complete-dealer-prep', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = { params: { id: 'del-1' } };

describe('POST /api/delivery-records/[id]/complete-dealer-prep', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockGetDelivery.mockReset();
    mockCompleteDealerPrep.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await POST(postRequest({}), params);
    expect(res.status).toBe(401);
  });

  it('returns 403 for a cross-dealer session (IDOR guard)', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D2' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });

    const res = await POST(postRequest({ notes: 'ready' }), params);
    expect(res.status).toBe(403);
    expect(mockCompleteDealerPrep).not.toHaveBeenCalled();
  });

  it('completes dealer prep for the same dealer', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
    mockCompleteDealerPrep.mockResolvedValue({ id: 'del-1', stage: 'CustomerDelivery' });

    const res = await POST(postRequest({ notes: 'ready' }), params);
    expect(res.status).toBe(200);
    expect(mockCompleteDealerPrep).toHaveBeenCalledWith('del-1', 'ready', expect.anything(), expect.anything());
  });
});
