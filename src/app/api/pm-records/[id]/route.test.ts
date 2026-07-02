import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockRepository = {
  list: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findDuplicate: vi.fn(),
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
};

const activeRecord = {
  id: 'rec-1',
  dealer_id: 'D1',
  branch_id: null,
  serial: null,
  technician_id: null,
  scheduled_date: null,
  performed_date: null,
  status: 'Scheduled',
  notes: null,
  created_by: 'alice',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_by: 'alice',
  updated_at: '2026-01-01T00:00:00.000Z',
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
      { username: 'alice' }
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
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.getById.mockResolvedValue(activeRecord);
    mockRepository.delete.mockResolvedValue(undefined);

    const res = await DELETE(deleteRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ ok: true, data: null });
    expect(mockRepository.delete).toHaveBeenCalledWith('rec-1', { username: 'alice' });
  });

  it('returns 404 for an already-deleted record', async () => {
    // getById already excludes soft-deleted rows (record_status='Deleted'),
    // so a second delete attempt sees the same not-found response as a
    // genuinely nonexistent id - that is the correct, soft-delete-aware
    // behavior, not a separate code path.
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.getById.mockResolvedValue(null);

    const res = await DELETE(deleteRequest(), params);
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'PM record not found' } });
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });
});
