import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockGetById = vi.fn();
const mockGetUrl = vi.fn();
const mockDelete = vi.fn();
const mockCanAccessAttachment = vi.fn();

vi.mock('@/shared/attachments', () => ({
  AttachmentService: vi.fn().mockImplementation(function () {
    return { getById: mockGetById, getUrl: mockGetUrl, delete: mockDelete };
  }),
  toUserFacingAttachmentError: (_err: unknown, context: string) => `error:${context}`,
  canAccessAttachment: (...args: unknown[]) => mockCanAccessAttachment(...args),
}));

const { getSession } = await import('@/lib/auth');
const { GET, DELETE } = await import('./route');

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

const attachment = { id: 'att-1', module: 'mqr', entityId: 'MQR-1' };
const params = { params: { id: 'att-1' } };

function getRequest() {
  return new NextRequest('http://localhost/api/attachments/att-1');
}

/** Production regression audit (2026-07-18): GET/DELETE by attachment id
 *  previously served/deleted any attachment for any authenticated user -
 *  no dealer/branch scope check existed. These tests pin that the route
 *  now consults `canAccessAttachment()` and returns 404 (not the
 *  attachment's data) when it denies access. */
describe('GET /api/attachments/[id]', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockGetById.mockReset();
    mockGetUrl.mockReset();
    mockCanAccessAttachment.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await GET(getRequest(), params);
    expect(res.status).toBe(401);
  });

  it('returns 404 when the attachment does not exist', async () => {
    vi.mocked(getSession).mockResolvedValue(session());
    mockGetById.mockResolvedValue(null);
    const res = await GET(getRequest(), params);
    expect(res.status).toBe(404);
    expect(mockCanAccessAttachment).not.toHaveBeenCalled();
  });

  it('returns 404 (not 200 with the URL) when canAccessAttachment denies access - the IDOR fix', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D2' }));
    mockGetById.mockResolvedValue(attachment);
    mockCanAccessAttachment.mockResolvedValue(false);

    const res = await GET(getRequest(), params);
    expect(res.status).toBe(404);
    expect(mockGetUrl).not.toHaveBeenCalled();
  });

  it('returns the signed URL when access is allowed', async () => {
    vi.mocked(getSession).mockResolvedValue(session());
    mockGetById.mockResolvedValue(attachment);
    mockCanAccessAttachment.mockResolvedValue(true);
    mockGetUrl.mockResolvedValue({ url: 'https://signed.example/file.jpg', expiresAt: null });

    const res = await GET(getRequest(), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe('https://signed.example/file.jpg');
  });
});

describe('DELETE /api/attachments/[id]', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockGetById.mockReset();
    mockDelete.mockReset();
    mockCanAccessAttachment.mockReset();
  });

  it('returns 401 when unauthorized', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await DELETE(getRequest(), params);
    expect(res.status).toBe(401);
  });

  it('returns 404 and never calls delete() when canAccessAttachment denies access - the IDOR fix', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ dealerId: 'D2' }));
    mockGetById.mockResolvedValue(attachment);
    mockCanAccessAttachment.mockResolvedValue(false);

    const res = await DELETE(getRequest(), params);
    expect(res.status).toBe(404);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes when access is allowed', async () => {
    vi.mocked(getSession).mockResolvedValue(session());
    mockGetById.mockResolvedValue(attachment);
    mockCanAccessAttachment.mockResolvedValue(true);
    mockDelete.mockResolvedValue(undefined);

    const res = await DELETE(getRequest(), params);
    expect(res.status).toBe(200);
    expect(mockDelete).toHaveBeenCalledWith('att-1');
  });
});
