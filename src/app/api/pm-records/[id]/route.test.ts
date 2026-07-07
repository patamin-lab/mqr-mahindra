import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// logAuditEvent/logAuditEvents touch Supabase directly - stub them (the
// Service layer's lock-guard/diff logic is what this file tests, not the
// audit write itself).
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, logAuditEvent: vi.fn(), logAuditEvents: vi.fn() };
});

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
  lockSupersededRecordsForVehicle: vi.fn(),
};

vi.mock('@/features/maintenance/repositories/supabaseMaintenanceRepository', () => ({
  SupabaseMaintenanceRepository: vi.fn().mockImplementation(function () {
    return mockRepository;
  }),
}));

const { getSession } = await import('@/lib/auth');
const { GET, PUT, DELETE } = await import('./route');

const dealerUserSession = {
  username: 'alice',
  fullName: 'Alice',
  role: 'DealerUser' as const,
  dealerId: 'D1',
  branch: null,
  branchId: 'B1',
};

const dealerAdminSession = {
  username: 'bob',
  fullName: 'Bob',
  role: 'DealerAdmin' as const,
  dealerId: 'D1',
  branch: null,
  branchId: null,
};

const otherDealerUserSession = {
  username: 'carol',
  fullName: 'Carol',
  role: 'DealerUser' as const,
  dealerId: 'D2',
  branch: null,
  branchId: null,
};

const otherDealerAdminSession = {
  username: 'dave',
  fullName: 'Dave',
  role: 'DealerAdmin' as const,
  dealerId: 'D2',
  branch: null,
  branchId: null,
};

const activeRecord = {
  id: 'rec-1',
  dealer_id: 'D1',
  branch_id: 'B1',
  serial: null,
  technician_id: null,
  scheduled_date: null,
  performed_date: null,
  status: 'Scheduled',
  notes: null,
  created_by: 'alice',
  // Recent by default so the calculation-lock's 24h editable window never
  // trips a fixed test fixture into "locked" as real time passes.
  created_at: new Date().toISOString(),
  updated_by: 'alice',
  updated_at: new Date().toISOString(),
  locked_at: null,
  locked_reason: null,
  unlocked_until: null,
  unlocked_by: null,
  unlock_reason: null,
  deleted_reason: null,
};

function getRequest() {
  return new NextRequest('http://localhost/api/pm-records/rec-1', { method: 'GET' });
}

function putRequest(body: unknown) {
  return new NextRequest('http://localhost/api/pm-records/rec-1', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function deleteRequest() {
  return new NextRequest('http://localhost/api/pm-records/rec-1', { method: 'DELETE' });
}

const params = { params: { id: 'rec-1' } };

describe('GET /api/pm-records/[id]', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockRepository.getById.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await GET(getRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
  });

  it('returns a successful detail', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.getById.mockResolvedValue(activeRecord);

    const res = await GET(getRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: activeRecord });
  });

  it('returns 404 when not found', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.getById.mockResolvedValue(null);

    const res = await GET(getRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } });
  });

  it("returns 403 when the actor belongs to a different dealer (cross-tenant IDOR guard)", async () => {
    vi.mocked(getSession).mockResolvedValue(otherDealerUserSession);
    mockRepository.getById.mockResolvedValue(activeRecord); // activeRecord.dealer_id === 'D1', actor is 'D2'

    const res = await GET(getRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');
  });
});

describe('PUT /api/pm-records/[id]', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockRepository.getById.mockReset();
    mockRepository.update.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await PUT(putRequest({ status: 'Completed' }), params);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('updates a record on success', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.getById.mockResolvedValue(activeRecord);
    const updated = { ...activeRecord, status: 'Completed' };
    mockRepository.update.mockResolvedValue(updated);

    const res = await PUT(putRequest({ status: 'Completed' }), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: updated });
    expect(mockRepository.update).toHaveBeenCalledWith(
      'rec-1',
      expect.objectContaining({ status: 'Completed' }),
      { username: 'alice', role: 'DealerUser' }
    );
  });

  it('returns a validation failure for an invalid status', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);

    const res = await PUT(putRequest({ status: '' }), params);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockRepository.getById).not.toHaveBeenCalled();
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it('returns 404 when the record does not exist', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.getById.mockResolvedValue(null);

    const res = await PUT(putRequest({ status: 'Completed' }), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } });
    expect(mockRepository.update).not.toHaveBeenCalled();
  });

  it("returns 403 when the actor belongs to a different dealer (cross-tenant IDOR guard)", async () => {
    vi.mocked(getSession).mockResolvedValue(otherDealerUserSession);
    mockRepository.getById.mockResolvedValue(activeRecord); // activeRecord.dealer_id === 'D1', actor is 'D2'

    const res = await PUT(putRequest({ status: 'Completed' }), params);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('FORBIDDEN');
    expect(mockRepository.update).not.toHaveBeenCalled();
  });
});

describe('DELETE /api/pm-records/[id]', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockRepository.getById.mockReset();
    mockRepository.delete.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const res = await DELETE(deleteRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it('deletes a record on success', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerAdminSession);
    mockRepository.getById.mockResolvedValue(activeRecord);
    mockRepository.delete.mockResolvedValue(undefined);

    const res = await DELETE(deleteRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: null });
    expect(mockRepository.delete).toHaveBeenCalledWith('rec-1', { username: 'bob', role: 'DealerAdmin' }, null);
  });

  it('returns 404 for an already-deleted record', async () => {
    // getById already excludes soft-deleted rows (record_status='Deleted'),
    // so a second delete attempt sees the same not-found response as a
    // genuinely nonexistent id - that is the correct, soft-delete-aware
    // behavior, not a separate code path.
    vi.mocked(getSession).mockResolvedValue(dealerAdminSession);
    mockRepository.getById.mockResolvedValue(null);

    const res = await DELETE(deleteRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } });
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it('returns 403 when a DealerUser attempts to delete (canDelete() gate, same as MQR)', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.getById.mockResolvedValue(activeRecord);

    const res = await DELETE(deleteRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(mockRepository.getById).not.toHaveBeenCalled();
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it("returns 403 when a DealerAdmin from another dealer attempts to delete (cross-tenant IDOR guard)", async () => {
    vi.mocked(getSession).mockResolvedValue(otherDealerAdminSession);
    mockRepository.getById.mockResolvedValue(activeRecord); // activeRecord.dealer_id === 'D1', actor is 'D2'

    const res = await DELETE(deleteRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.ok).toBe(false);
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });
});
