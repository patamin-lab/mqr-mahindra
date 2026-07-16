import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockGetVehicleBySerial = vi.fn();
vi.mock('@/lib/db', () => ({
  getVehicleBySerial: mockGetVehicleBySerial,
}));

const mockListDeliveries = vi.fn();
const mockCreateDeliveryRecord = vi.fn();
vi.mock('@/features/delivery', () => ({
  DeliveryService: vi.fn().mockImplementation(function () {
    return {
      listDeliveries: mockListDeliveries,
      createDeliveryRecord: mockCreateDeliveryRecord,
    };
  }),
}));

const { getSession } = await import('@/lib/auth');
const { GET, POST } = await import('./route');

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

function getRequest(url: string) {
  return new NextRequest(url);
}
function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/delivery-records', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/delivery-records', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockListDeliveries.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await GET(getRequest('http://localhost/api/delivery-records'));
    expect(res.status).toBe(401);
  });

  it('a DealerUser is pinned to their own dealer regardless of a requested dealerId', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'DealerUser', dealerId: 'D1' }));
    mockListDeliveries.mockResolvedValue([]);

    await GET(getRequest('http://localhost/api/delivery-records?dealerId=D9'));
    expect(mockListDeliveries).toHaveBeenCalledWith(expect.objectContaining({ dealerId: 'D1' }));
  });

  it('a SuperAdmin may request any dealerId', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'SuperAdmin', dealerId: null }));
    mockListDeliveries.mockResolvedValue([]);

    await GET(getRequest('http://localhost/api/delivery-records?dealerId=D9'));
    expect(mockListDeliveries).toHaveBeenCalledWith(expect.objectContaining({ dealerId: 'D9' }));
  });
});

describe('POST /api/delivery-records', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockGetVehicleBySerial.mockReset();
    mockCreateDeliveryRecord.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await POST(postRequest({ serial: 'SN-1' }));
    expect(res.status).toBe(401);
    expect(mockCreateDeliveryRecord).not.toHaveBeenCalled();
  });

  it('returns 400 when serial is missing', async () => {
    vi.mocked(getSession).mockResolvedValue(session());
    const res = await POST(postRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 404 when the vehicle is not found in this session\'s scope', async () => {
    vi.mocked(getSession).mockResolvedValue(session());
    mockGetVehicleBySerial.mockResolvedValue(null);
    const res = await POST(postRequest({ serial: 'SN-1' }));
    expect(res.status).toBe(404);
    expect(mockCreateDeliveryRecord).not.toHaveBeenCalled();
  });

  it('creates a delivery record from the resolved vehicle, never a client-supplied dealerId', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D1' }));
    mockGetVehicleBySerial.mockResolvedValue({ id: 'veh-1', serial: 'SN-1', dealer_id: 'D1' });
    mockCreateDeliveryRecord.mockResolvedValue({ id: 'del-1', deliveryRef: 'DEL-2026-000001' });

    const res = await POST(postRequest({ serial: 'SN-1' }));
    expect(res.status).toBe(201);
    expect(mockCreateDeliveryRecord).toHaveBeenCalledWith(
      { vehicleId: 'veh-1', serial: 'SN-1', dealerId: 'D1' },
      expect.objectContaining({ username: 'alice' })
    );
  });
});
