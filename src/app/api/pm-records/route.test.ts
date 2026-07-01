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
};

vi.mock('@/features/pm-record/supabaseRepository', () => ({
  SupabasePmRecordRepository: vi.fn().mockImplementation(function () {
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

    const res = await POST(postRequest({ status: 'Scheduled' }));
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json).toEqual({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } });
    expect(mockRepository.create).not.toHaveBeenCalled();
  });

  it('creates a record on success', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);
    mockRepository.create.mockResolvedValue(activeRecord);

    const res = await POST(postRequest({ status: 'Scheduled', notes: 'first service' }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json).toEqual({ ok: true, data: activeRecord });
    expect(mockRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ dealer_id: 'D1', status: 'Scheduled' }),
      { username: 'alice' }
    );
  });

  it('returns a validation failure when status is missing', async () => {
    vi.mocked(getSession).mockResolvedValue(dealerUserSession);

    const res = await POST(postRequest({}));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe('VALIDATION_ERROR');
    expect(mockRepository.create).not.toHaveBeenCalled();
  });
});
