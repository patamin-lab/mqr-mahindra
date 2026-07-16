import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockGetDelivery = vi.fn();
const mockLinkInspection = vi.fn();
vi.mock('@/features/delivery', () => ({
  DeliveryService: vi.fn().mockImplementation(function () {
    return {
      getDelivery: mockGetDelivery,
      linkInspection: mockLinkInspection,
    };
  }),
}));

const mockListInspectionsByIds = vi.fn();
vi.mock('@/features/inspection', () => ({
  InspectionService: vi.fn().mockImplementation(function () {
    return {
      listInspectionsByIds: mockListInspectionsByIds,
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
  return new NextRequest('http://localhost/api/delivery-records/del-1/link-inspection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = { params: { id: 'del-1' } };

describe('POST /api/delivery-records/[id]/link-inspection', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockGetDelivery.mockReset();
    mockLinkInspection.mockReset();
    mockListInspectionsByIds.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await POST(postRequest({ inspectionId: 'insp-1' }), params);
    expect(res.status).toBe(401);
  });

  it('returns 403 for a cross-dealer session (IDOR guard)', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D2' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });

    const res = await POST(postRequest({ inspectionId: 'insp-1' }), params);
    expect(res.status).toBe(403);
    expect(mockLinkInspection).not.toHaveBeenCalled();
  });

  it('returns 404 when the inspection does not exist', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
    mockListInspectionsByIds.mockResolvedValue([]);

    const res = await POST(postRequest({ inspectionId: 'insp-1' }), params);
    expect(res.status).toBe(404);
    expect(mockLinkInspection).not.toHaveBeenCalled();
  });

  it('resolves inspectionCompleted server-side from the inspection\'s own status, not the client', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
    mockListInspectionsByIds.mockResolvedValue([{ id: 'insp-1', status: 'Completed' }]);
    mockLinkInspection.mockResolvedValue({ id: 'del-1', stage: 'DealerPreparation' });

    const res = await POST(postRequest({ inspectionId: 'insp-1', inspectionCompleted: false }), params);
    expect(res.status).toBe(200);
    expect(mockLinkInspection).toHaveBeenCalledWith('del-1', 'insp-1', true, expect.anything(), expect.anything());
  });

  it('surfaces the service\'s own canAccessImportInspection rejection as 403', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
    mockListInspectionsByIds.mockResolvedValue([{ id: 'insp-1', status: 'InProgress' }]);
    mockLinkInspection.mockRejectedValue(new Error('Role DealerUser may not link an Import Inspection to a Delivery record'));

    const res = await POST(postRequest({ inspectionId: 'insp-1' }), params);
    expect(res.status).toBe(403);
  });
});
