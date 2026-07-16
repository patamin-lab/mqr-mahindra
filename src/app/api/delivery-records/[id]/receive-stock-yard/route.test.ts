import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockGetDelivery = vi.fn();
const mockReceiveAtStockYard = vi.fn();
vi.mock('@/features/delivery', () => ({
  DeliveryService: vi.fn().mockImplementation(function () {
    return {
      getDelivery: mockGetDelivery,
      receiveAtStockYard: mockReceiveAtStockYard,
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
  return new NextRequest('http://localhost/api/delivery-records/del-1/receive-stock-yard', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = { params: { id: 'del-1' } };

describe('POST /api/delivery-records/[id]/receive-stock-yard', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockGetDelivery.mockReset();
    mockReceiveAtStockYard.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await POST(postRequest({}), params);
    expect(res.status).toBe(401);
  });

  it('returns 403 for a cross-dealer session (IDOR guard)', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D2' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });

    const res = await POST(postRequest({ location: 'Bay 3' }), params);
    expect(res.status).toBe(403);
    expect(mockReceiveAtStockYard).not.toHaveBeenCalled();
  });

  it('a SuperAdmin may act across dealers', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'SuperAdmin', dealerId: null }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
    mockReceiveAtStockYard.mockResolvedValue({ id: 'del-1', stage: 'StockYard' });

    const res = await POST(postRequest({ location: 'Bay 3' }), params);
    expect(res.status).toBe(200);
    expect(mockReceiveAtStockYard).toHaveBeenCalledWith('del-1', 'Bay 3', expect.anything());
  });

  it('normalizes a blank location to null', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
    mockReceiveAtStockYard.mockResolvedValue({ id: 'del-1', stage: 'StockYard' });

    await POST(postRequest({ location: '   ' }), params);
    expect(mockReceiveAtStockYard).toHaveBeenCalledWith('del-1', null, expect.anything());
  });
});
