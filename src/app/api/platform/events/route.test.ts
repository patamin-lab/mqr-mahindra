import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getVehicleBySerial: vi.fn(),
}));

const mockService = {
  searchEvents: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
};
const mockPublisher = {
  publish: vi.fn(),
};

vi.mock('@/features/vehicle-event/factory', () => ({
  createVehicleEventService: () => mockService,
  createVehicleEventPublisher: () => mockPublisher,
}));

const { getSession } = await import('@/lib/auth');
const { getVehicleBySerial } = await import('@/lib/db');
const { GET, POST, PUT, DELETE } = await import('./route');

const dealerUserSession = {
  username: 'alice',
  fullName: 'Alice',
  role: 'DealerUser' as const,
  dealerId: 'D1',
  branch: null,
  branchId: null,
};

const superAdminSession = {
  username: 'admin',
  fullName: 'Admin',
  role: 'SuperAdmin' as const,
  dealerId: null,
  branch: null,
  branchId: null,
};

const activeEvent = {
  id: 'evt-1',
  vehicle_id: 'veh-1',
  event_definition_id: 'def-1',
  source_module: 'maintenance',
  reference_id: 'PM-D1-2026-000001',
  event_datetime: '2026-01-01T00:00:00.000Z',
  title: 'บำรุงรักษาเชิงป้องกัน',
  description: null,
  metadata: {},
  status: null,
  created_by: 'alice',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_by: 'alice',
  updated_at: '2026-01-01T00:00:00.000Z',
  record_status: 'Active',
};

function getRequest(url: string) {
  return new NextRequest(url);
}

function jsonRequest(url: string, method: string, body: unknown) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/platform/events', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockService.searchEvents.mockReset();
    vi.mocked(getVehicleBySerial).mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await GET(getRequest('http://localhost/api/platform/events'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
    expect(mockService.searchEvents).not.toHaveBeenCalled();
  });

  it('pins a non-privileged caller to their own dealer regardless of query params', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockService.searchEvents.mockResolvedValue({ data: [activeEvent], total: 1 });

    const res = await GET(getRequest('http://localhost/api/platform/events'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: [activeEvent], total: 1 });
    expect(mockService.searchEvents).toHaveBeenCalledWith(expect.objectContaining({ dealerId: 'D1' }));
  });

  it('does not scope by dealer for a privileged caller', async () => {
    vi.mocked(getSession).mockResolvedValue(superAdminSession);
    mockService.searchEvents.mockResolvedValue({ data: [], total: 0 });

    await GET(getRequest('http://localhost/api/platform/events'));

    expect(mockService.searchEvents).toHaveBeenCalledWith(expect.objectContaining({ dealerId: null }));
  });

  it('resolves a serial query param to vehicleId before searching', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    vi.mocked(getVehicleBySerial).mockResolvedValue({ id: 'veh-1', serial: 'SN-1', model: null, delivery_date: null, dealer_id: 'D1' });
    mockService.searchEvents.mockResolvedValue({ data: [activeEvent], total: 1 });

    await GET(getRequest('http://localhost/api/platform/events?serial=SN-1'));

    expect(getVehicleBySerial).toHaveBeenCalledWith('SN-1', { dealerId: 'D1', unrestricted: false });
    expect(mockService.searchEvents).toHaveBeenCalledWith(expect.objectContaining({ vehicleId: 'veh-1' }));
  });

  it('returns an empty result when the serial does not resolve to a vehicle', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    vi.mocked(getVehicleBySerial).mockResolvedValue(null);

    const res = await GET(getRequest('http://localhost/api/platform/events?serial=UNKNOWN'));
    const json = await res.json();

    expect(json).toEqual({ ok: true, data: [], total: 0 });
    expect(mockService.searchEvents).not.toHaveBeenCalled();
  });
});

describe('POST /api/platform/events', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockPublisher.publish.mockReset();
  });

  const validBody = {
    eventCode: 'MAINTENANCE_COMPLETED',
    serial: 'SN-1',
    sourceModule: 'maintenance',
    referenceId: 'PM-D1-2026-000001',
    title: 'บำรุงรักษาเชิงป้องกัน',
  };

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await POST(jsonRequest('http://localhost/api/platform/events', 'POST', validBody));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('publishes via VehicleEventPublisher.publish() on success', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockPublisher.publish.mockResolvedValue(activeEvent);

    const res = await POST(jsonRequest('http://localhost/api/platform/events', 'POST', validBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ ok: true, data: activeEvent });
    expect(mockPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventCode: 'MAINTENANCE_COMPLETED',
        serial: 'SN-1',
        sourceModule: 'maintenance',
        referenceId: 'PM-D1-2026-000001',
        title: 'บำรุงรักษาเชิงป้องกัน',
        actor: { username: 'alice' },
      })
    );
  });

  it('returns a validation failure when required fields are missing', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);

    const res = await POST(jsonRequest('http://localhost/api/platform/events', 'POST', {}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('returns a validation failure for an unknown eventCode', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);

    const res = await POST(jsonRequest('http://localhost/api/platform/events', 'POST', { ...validBody, eventCode: 'NOT_REAL' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('maps a publisher "not found" error to 400 VALIDATION_ERROR, not 500', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockPublisher.publish.mockRejectedValue(new Error('Cannot publish event: no vehicle found for serial "SN-1"'));

    const res = await POST(jsonRequest('http://localhost/api/platform/events', 'POST', validBody));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PUT /api/platform/events', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockService.updateEvent.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await PUT(jsonRequest('http://localhost/api/platform/events', 'PUT', { id: 'evt-1', title: 'x' }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(mockService.updateEvent).not.toHaveBeenCalled();
  });

  it('updates via VehicleEventService.updateEvent() on success', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockService.updateEvent.mockResolvedValue({ ...activeEvent, title: 'Updated' });

    const res = await PUT(jsonRequest('http://localhost/api/platform/events', 'PUT', { id: 'evt-1', title: 'Updated' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: { ...activeEvent, title: 'Updated' } });
    expect(mockService.updateEvent).toHaveBeenCalledWith('evt-1', { title: 'Updated' }, { username: 'alice' });
  });

  it('returns a validation failure when id is missing', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);

    const res = await PUT(jsonRequest('http://localhost/api/platform/events', 'PUT', { title: 'x' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockService.updateEvent).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/platform/events', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockService.deleteEvent.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await DELETE(getRequest('http://localhost/api/platform/events?id=evt-1'));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(mockService.deleteEvent).not.toHaveBeenCalled();
  });

  it('soft-deletes via VehicleEventService.deleteEvent() on success', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockService.deleteEvent.mockResolvedValue(undefined);

    const res = await DELETE(getRequest('http://localhost/api/platform/events?id=evt-1'));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: null });
    expect(mockService.deleteEvent).toHaveBeenCalledWith('evt-1', { username: 'alice' });
  });

  it('returns a validation failure when id is missing', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);

    const res = await DELETE(getRequest('http://localhost/api/platform/events'));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockService.deleteEvent).not.toHaveBeenCalled();
  });
});
