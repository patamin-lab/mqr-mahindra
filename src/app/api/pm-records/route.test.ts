import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// getDealer is called after a successful create - mocked so this
// integration test never touches Supabase for real, per the "mock
// Repository layer only, never connect to Supabase" constraint.
// logAuditEvent/logAuditEvents are called by MaintenanceService.create()
// now too - same reasoning.
vi.mock('@/lib/db', () => ({
  getDealer: vi.fn().mockResolvedValue({ id: 'D1', short_name: 'D1' }),
  logAuditEvent: vi.fn(),
  logAuditEvents: vi.fn(),
  listActivePmIntervals: vi.fn().mockResolvedValue([{ id: 'interval-1', label: '50 Hr', interval_hours: 50, interval_months: null }]),
}));

const mockRepository = {
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findDuplicate: vi.fn(),
  listHistory: vi.fn(),
  lockRecord: vi.fn(),
  unlockRecord: vi.fn(),
  lockSupersededRecordsForVehicle: vi.fn().mockResolvedValue([]),
};

vi.mock('@/features/maintenance/repositories/supabaseMaintenanceRepository', () => ({
  SupabaseMaintenanceRepository: vi.fn().mockImplementation(function () {
    return mockRepository;
  }),
}));

const { getSession } = await import('@/lib/auth');
const { GET, POST } = await import('./route');

const dealerUserSession = {
  username: 'alice',
  fullName: 'Alice',
  role: 'DealerUser' as const,
  dealerId: 'D1',
  branch: null,
};

const activeRecord = {
  id: 'rec-1',
  dealer_id: 'D1',
  branch_id: null,
  serial: 'SN-1',
  model: null,
  delivery_date: null,
  engine_number: null,
  customer_name: 'Somchai',
  customer_phone: '081-2345678',
  technician_id: 'tech-1',
  scheduled_date: null,
  performed_date: '2026-01-01',
  hour_meter: 100,
  pm_interval_id: 'interval-1',
  pm_number: 'PM-D1-2026-000001',
  meter_photo_url: 'https://drive.google.com/meter.jpg',
  nameplate_photo_url: 'https://drive.google.com/nameplate.jpg',
  report_photo_url: 'https://drive.google.com/report.jpg',
  status: 'Scheduled',
  notes: null,
  created_by: 'alice',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_by: 'alice',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const validCreateBody = {
  branch_id: null,
  serial: 'SN-1',
  model: 'Model X',
  delivery_date: '2025-01-01',
  engine_number: 'EN-1',
  customer_name: 'Somchai',
  customer_phone: '0812345678',
  technician_id: 'tech-1',
  performed_date: '2026-01-01',
  hour_meter: 100,
  pm_interval_id: 'interval-1',
  meter_photo_url: 'https://drive.google.com/meter.jpg',
  nameplate_photo_url: 'https://drive.google.com/nameplate.jpg',
  report_photo_url: 'https://drive.google.com/report.jpg',
  notes: null,
};

function postRequest(body: unknown) {
  return new NextRequest('http://localhost/api/pm-records', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('GET /api/pm-records', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockRepository.list.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
    expect(mockRepository.list).not.toHaveBeenCalled();
  });

  it('returns an empty result', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.list.mockResolvedValue([]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: [] });
  });

  it('returns a successful list', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.list.mockResolvedValue([activeRecord]);

    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: [activeRecord] });
  });
});

describe('POST /api/pm-records', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockRepository.create.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await POST(postRequest(validCreateBody));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it('creates a record on success, normalizing the phone number', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.create.mockResolvedValue(activeRecord);

    const res = await POST(postRequest(validCreateBody));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ ok: true, data: activeRecord });
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        dealer_id: 'D1',
        serial: 'SN-1',
        customer_name: 'Somchai',
        customer_phone: '081-2345678',
        hour_meter: 100,
        pm_interval_id: 'interval-1',
      }),
      { username: 'alice' }
    );
  });

  it('returns a validation failure when required fields are missing', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);

    const res = await POST(postRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it('returns a validation failure for an invalid phone number', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);

    const res = await POST(postRequest({ ...validCreateBody, customer_phone: '123' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a pm_interval_id not in the vehicle model\'s resolved Maintenance Program', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);

    const res = await POST(postRequest({ ...validCreateBody, pm_interval_id: 'interval-NOT-ALLOWED' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it('skips the Maintenance Program re-validation when no model is known (stockNote fallback path)', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.create.mockResolvedValue(activeRecord);

    const res = await POST(postRequest({ ...validCreateBody, model: null, pm_interval_id: 'interval-ANYTHING' }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ ok: true, data: activeRecord });
  });
});
