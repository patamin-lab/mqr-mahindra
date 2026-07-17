import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, logAuditEvent: vi.fn(), logAuditEvents: vi.fn() };
});

const mockAssertBranchAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/dealerBranchScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dealerBranchScope')>();
  return { ...actual, assertBranchAccess: mockAssertBranchAccess };
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

const mockRunNtrWarrantyOrchestration = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/ntr/services/ntrPostCreateOrchestration', () => ({
  runNtrWarrantyOrchestration: mockRunNtrWarrantyOrchestration,
}));

const { getSession } = await import('@/lib/auth');
const { GET, PUT, DELETE } = await import('./route');

const dealerAdminSessionD1 = {
  username: 'bob',
  fullName: 'Bob',
  role: 'DealerAdmin' as const,
  dealerId: 'D1',
  branch: null,
  branchId: null,
  sessionId: 'test-session',
  forcePasswordChange: false,
};

const dealerUserSessionD1 = {
  username: 'alice',
  fullName: 'Alice',
  role: 'DealerUser' as const,
  dealerId: 'D1',
  branch: null,
  branchId: null,
  sessionId: 'test-session',
  forcePasswordChange: false,
};

const dealerAdminSessionD2 = {
  username: 'dave',
  fullName: 'Dave',
  role: 'DealerAdmin' as const,
  dealerId: 'D2',
  branch: null,
  branchId: null,
  sessionId: 'test-session',
  forcePasswordChange: false,
};

const superAdminSession = {
  username: 'root',
  fullName: 'Root',
  role: 'SuperAdmin' as const,
  dealerId: null,
  branch: null,
  branchId: null,
  sessionId: 'test-session',
  forcePasswordChange: false,
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
  photo_customer_id_url: 'https://example.com/e.jpg',
  photo_customer_tractor_url: 'https://example.com/a.jpg',
  photo_serial_plate_url: 'https://example.com/b.jpg',
  photo_hour_meter_url: 'https://example.com/c.jpg',
  photo_signed_document_url: 'https://example.com/d.jpg',
  photo_customer_id_attachment_id: null,
  photo_customer_tractor_attachment_id: null,
  photo_serial_plate_attachment_id: null,
  photo_hour_meter_attachment_id: null,
  photo_signed_document_attachment_id: null,
  video_attachment_id: null,
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
    mockAssertBranchAccess.mockReset().mockResolvedValue(undefined);
    mockRunNtrWarrantyOrchestration.mockClear();
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

  /** Regression: `runNtrWarrantyOrchestration` must re-run after an edit,
   *  not only after create - Vehicle360's dealer/branch/delivery date/PM
   *  schedule must reflect the *latest* NTR, and an edit is the only way
   *  a dealer corrects a mistaken Dealer/Delivery Date after the fact. */
  it('re-runs runNtrWarrantyOrchestration with the updated record after a successful edit', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerAdminSessionD1);
    mockRepository.getById.mockResolvedValue(activeRecord);
    const updated = { ...activeRecord, customer_name: 'New Name' };
    mockRepository.update.mockResolvedValue(updated);

    await PUT(putRequest({ customer_name: 'New Name' }), params);

    expect(mockRunNtrWarrantyOrchestration).toHaveBeenCalledWith(updated, { username: 'bob', role: 'DealerAdmin' });
  });

  it('does not let a failing orchestration fail the edit response (non-blocking, same as create)', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerAdminSessionD1);
    mockRepository.getById.mockResolvedValue(activeRecord);
    const updated = { ...activeRecord, customer_name: 'New Name' };
    mockRepository.update.mockResolvedValue(updated);
    mockRunNtrWarrantyOrchestration.mockRejectedValueOnce(new Error('vehicle sync unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await PUT(putRequest({ customer_name: 'New Name' }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: updated });
    consoleError.mockRestore();
  });

  describe('Dealer reassignment (NTR Form Update, 2026-07)', () => {
    it('lets a seesAllDealers actor (SuperAdmin) change dealer_id', async () => {
      vi.mocked(getSession).mockResolvedValue(superAdminSession);
      mockRepository.getById.mockResolvedValue(activeRecord); // dealer_id: 'D1'
      const updated = { ...activeRecord, dealer_id: 'D2' };
      mockRepository.update.mockResolvedValue(updated);

      const res = await PUT(putRequest({ customer_name: 'New Name', dealer_id: 'D2', branch_id: null }), params);
      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json).toEqual({ ok: true, data: updated });
      expect(mockAssertBranchAccess).toHaveBeenCalledWith('D2', null);
      expect(mockRepository.update).toHaveBeenCalledWith('ntr-1', expect.objectContaining({ dealer_id: 'D2' }), expect.anything());
      expect(mockRunNtrWarrantyOrchestration).toHaveBeenCalledWith(updated, { username: 'root', role: 'SuperAdmin' });
    });

    it('silently ignores dealer_id from a DealerAdmin (never trusted, no error)', async () => {
      vi.mocked(getSession).mockResolvedValue(dealerAdminSessionD1);
      mockRepository.getById.mockResolvedValue(activeRecord); // dealer_id: 'D1'
      const updated = { ...activeRecord, customer_name: 'New Name' };
      mockRepository.update.mockResolvedValue(updated);

      const res = await PUT(putRequest({ customer_name: 'New Name', dealer_id: 'D2' }), params);
      expect(res.status).toBe(200);
      expect(mockAssertBranchAccess).not.toHaveBeenCalled();
      const [, calledInput] = mockRepository.update.mock.calls[0];
      expect(calledInput.dealer_id).toBeUndefined();
    });

    it('rejects a branch_id that does not belong to the new dealer_id', async () => {
      vi.mocked(getSession).mockResolvedValue(superAdminSession);
      mockRepository.getById.mockResolvedValue(activeRecord); // dealer_id: 'D1'
      mockAssertBranchAccess.mockRejectedValueOnce(new Error('FORBIDDEN_BRANCH'));

      const res = await PUT(putRequest({ customer_name: 'New Name', dealer_id: 'D2', branch_id: 'stale-branch' }), params);
      const json = await res.json();
      expect(res.status).toBe(400);
      expect(json.error.message).toMatch(/branch_id does not belong/);
      expect(mockRepository.update).not.toHaveBeenCalled();
    });

    it('does not re-validate branch when dealer_id is unchanged', async () => {
      vi.mocked(getSession).mockResolvedValue(superAdminSession);
      mockRepository.getById.mockResolvedValue(activeRecord); // dealer_id: 'D1'
      mockRepository.update.mockResolvedValue(activeRecord);

      const res = await PUT(putRequest({ customer_name: 'New Name', dealer_id: 'D1' }), params);
      expect(res.status).toBe(200);
      expect(mockAssertBranchAccess).not.toHaveBeenCalled();
    });
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
