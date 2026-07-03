import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, logAuditEvent: vi.fn(), logAuditEvents: vi.fn() };
});

const mockRepository = {
  getById: vi.fn(),
  findActiveBySerial: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  listHistory: vi.fn(),
};

vi.mock('@/features/ntr/repositories/supabaseNtrRepository', () => ({
  SupabaseNtrRepository: vi.fn().mockImplementation(function () {
    return mockRepository;
  }),
}));

const mockPublisher = {
  publish: vi.fn(),
  publishNtrCreated: vi.fn(),
  publishNtrCompleted: vi.fn(),
};

vi.mock('@/features/vehicle-event/factory', () => ({
  createVehicleEventPublisher: vi.fn().mockReturnValue(mockPublisher),
}));

const { getSession } = await import('@/lib/auth');
const { GET, PUT, DELETE } = await import('./route');

const dealerAdminSessionD1 = {
  username: 'bob',
  fullName: 'Bob',
  role: 'DealerAdmin' as const,
  dealerId: 'D1',
  branch: null,
};

const dealerUserSessionD1 = {
  username: 'alice',
  fullName: 'Alice',
  role: 'DealerUser' as const,
  dealerId: 'D1',
  branch: null,
};

const dealerAdminSessionD2 = {
  username: 'dave',
  fullName: 'Dave',
  role: 'DealerAdmin' as const,
  dealerId: 'D2',
  branch: null,
};

const activeRecord = {
  id: 'ntr-1',
  ntr_number: 'NTR-D1-2026-000001',
  dealer_id: 'D1',
  branch_id: null,
  serial: 'SN-1',
  model: 'Model X',
  engine_number: null,
  salesperson: null,
  receiving_person: null,
  customer_name: 'Somchai',
  customer_phone: '081-2345678',
  customer_address: null,
  customer_district: null,
  customer_province: null,
  customer_postal_code: null,
  customer_type: null,
  retail_date: null,
  delivery_date: '2026-01-01',
  hour_meter: null,
  latitude: null,
  longitude: null,
  gps_accuracy: null,
  google_maps_url: null,
  photo_customer_tractor_url: 'https://example.com/a.jpg',
  photo_serial_plate_url: 'https://example.com/b.jpg',
  photo_hour_meter_url: 'https://example.com/c.jpg',
  photo_signed_document_url: 'https://example.com/d.jpg',
  additional_photos: [],
  video_url: null,
  audio_url: null,
  status: 'Completed',
  record_status: 'Active',
  deleted_by: null,
  deleted_at: null,
  import_session_id: null,
  source: 'manual',
  created_by: 'alice',
  created_at: new Date().toISOString(),
  updated_by: 'alice',
  updated_at: new Date().toISOString(),
};

function getRequest() {
  return new NextRequest('http://localhost/api/ntr-records/ntr-1', { method: 'GET' });
}
function putRequest(body: unknown) {
  return new NextRequest('http://localhost/api/ntr-records/ntr-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
function deleteRequest() {
  return new NextRequest('http://localhost/api/ntr-records/ntr-1', { method: 'DELETE' });
}

const params = { params: { id: 'ntr-1' } };

describe('GET /api/ntr-records/[id]', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockRepository.getById.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await GET(getRequest(), params);
    expect(res.status).toBe(401);
  });

  it('returns the record for a same-dealer session', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerAdminSessionD1);
    mockRepository.getById.mockResolvedValue(activeRecord);
    const res = await GET(getRequest(), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: activeRecord });
  });

  it('returns 404 when not found', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerAdminSessionD1);
    mockRepository.getById.mockResolvedValue(null);
    const res = await GET(getRequest(), params);
    expect(res.status).toBe(404);
  });

  it('returns 403 for a cross-tenant session (IDOR guard)', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerAdminSessionD2);
    mockRepository.getById.mockResolvedValue(activeRecord); // dealer_id === 'D1', actor is 'D2'
    const res = await GET(getRequest(), params);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error.code).toBe('FORBIDDEN');
  });
});

describe('PUT /api/ntr-records/[id]', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockRepository.getById.mockReset();
    mockRepository.update.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await PUT(putRequest({ customer_name: 'New Name' }), params);
    expect(res.status).toBe(401);
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('updates a record on success', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerAdminSessionD1);
    mockRepository.getById.mockResolvedValue(activeRecord);
    const updated = { ...activeRecord, customer_name: 'New Name' };
    mockRepository.update.mockResolvedValue(updated);

    const res = await PUT(putRequest({ customer_name: 'New Name' }), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: updated });
  });

  it('returns 403 for a cross-tenant session (IDOR guard)', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerAdminSessionD2);
    mockRepository.getById.mockResolvedValue(activeRecord);

    const res = await PUT(putRequest({ customer_name: 'New Name' }), params);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error.code).toBe('FORBIDDEN');
    expect(mockRepository.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/ntr-records/[id]', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockRepository.getById.mockReset();
    mockRepository.delete.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await DELETE(deleteRequest(), params);
    expect(res.status).toBe(401);
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it('returns 403 when a DealerUser attempts to delete (canDelete() gate, same as MQR/PM)', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSessionD1);
    const res = await DELETE(deleteRequest(), params);
    expect(res.status).toBe(403);
    expect(mockRepository.getById).not.toHaveBeenCalled();
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it('deletes a record on success for an authorized role', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerAdminSessionD1);
    mockRepository.getById.mockResolvedValue(activeRecord);
    mockRepository.delete.mockResolvedValue(undefined);

    const res = await DELETE(deleteRequest(), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: null });
  });

  it('returns 403 for a cross-tenant session (IDOR guard)', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerAdminSessionD2);
    mockRepository.getById.mockResolvedValue(activeRecord);

    const res = await DELETE(deleteRequest(), params);
    const json = await res.json();
    expect(res.status).toBe(403);
    expect(json.error.code).toBe('FORBIDDEN');
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });
});
