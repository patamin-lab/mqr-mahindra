import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockGetDelivery = vi.fn();
const mockRecordTraining = vi.fn();
vi.mock('@/features/delivery', () => ({
  DeliveryService: vi.fn().mockImplementation(function () {
    return {
      getDelivery: mockGetDelivery,
      recordTraining: mockRecordTraining,
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
  return new NextRequest('http://localhost/api/delivery-records/del-1/training', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const params = { params: { id: 'del-1' } };
const validBody = { operatorName: 'Somchai', trainerName: 'Wichai', trainingDate: '2026-07-01' };

describe('POST /api/delivery-records/[id]/training', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockGetDelivery.mockReset();
    mockRecordTraining.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await POST(postRequest(validBody), params);
    expect(res.status).toBe(401);
  });

  it('returns 403 for a cross-dealer session (IDOR guard)', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D2' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });

    const res = await POST(postRequest(validBody), params);
    expect(res.status).toBe(403);
    expect(mockRecordTraining).not.toHaveBeenCalled();
  });

  it('returns 400 when required fields are missing', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });

    const res = await POST(postRequest({ operatorName: 'Somchai' }), params);
    expect(res.status).toBe(400);
    expect(mockRecordTraining).not.toHaveBeenCalled();
  });

  it('records training with normalized topics for the same dealer', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D1' }));
    mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
    mockRecordTraining.mockResolvedValue({ id: 'del-1', stage: 'DeliveryAcceptance' });

    const res = await POST(
      postRequest({ ...validBody, trainingTopics: [{ topic: 'Safety', covered: true }, { topic: '  ' }] }),
      params
    );
    expect(res.status).toBe(200);
    expect(mockRecordTraining).toHaveBeenCalledWith(
      'del-1',
      expect.objectContaining({
        operatorName: 'Somchai',
        trainerName: 'Wichai',
        trainingDate: '2026-07-01',
        trainingTopics: [{ topic: 'Safety', covered: true }],
      }),
      expect.anything()
    );
  });
});
