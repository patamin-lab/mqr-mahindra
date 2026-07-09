import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockImportService = {
  preview: vi.fn(),
  commit: vi.fn(),
  listSessions: vi.fn(),
  listArchiveQueue: vi.fn(),
  processArchiveQueue: vi.fn(),
};

vi.mock('@/features/ntr/factory', () => ({
  createNtrImportService: vi.fn().mockReturnValue(mockImportService),
  createNtrService: vi.fn(),
}));

vi.mock('@/lib/googleDrive', () => ({
  uploadFileToDrive: vi.fn(),
}));

const { getSession } = await import('@/lib/auth');
const { POST: previewPOST } = await import('./preview/route');
const { POST: commitPOST } = await import('./commit/route');
const { GET: sessionsGET } = await import('./sessions/route');
const { GET: archiveGET, POST: archivePOST } = await import('./archive/route');

const superAdminSession = { username: 'root', fullName: 'Root', role: 'SuperAdmin' as const, dealerId: null, branch: null, branchId: null, sessionId: 'test-session', forcePasswordChange: false };
const dealerAdminSession = { username: 'bob', fullName: 'Bob', role: 'DealerAdmin' as const, dealerId: 'D1', branch: null, branchId: null, sessionId: 'test-session', forcePasswordChange: false };
const centralAdminSession = { username: 'carol', fullName: 'Carol', role: 'CentralAdmin' as const, dealerId: null, branch: null, branchId: null, sessionId: 'test-session', forcePasswordChange: false };

/**
 * Every Legacy Import route must reject every role except SuperAdmin -
 * per spec, "Dealer users, Dealer Admin, Technician must never see this
 * feature," and this permission check is intentionally the *only* gate
 * (application-layer, not RLS - see docs/standards/SECURITY_STANDARD.md).
 * These tests exist specifically to prove the gate runs before any
 * service/database call, for all three roles a real deployment will see.
 */
describe('Legacy Import route permissions', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
    mockImportService.preview.mockReset();
    mockImportService.commit.mockReset();
    mockImportService.listSessions.mockReset();
    mockImportService.listArchiveQueue.mockReset();
    mockImportService.processArchiveQueue.mockReset();
  });

  describe('POST /api/ntr/import/preview', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/ntr/import/preview', { method: 'POST', body: new FormData() });
      const res = await previewPOST(req);
      expect(res.status).toBe(401);
      expect(mockImportService.preview).not.toHaveBeenCalled();
    });

    it.each([
      ['DealerAdmin', dealerAdminSession],
      ['CentralAdmin (MSEAL)', centralAdminSession],
    ])('returns 403 for %s', async (_label, session) => {
      vi.mocked(getSession).mockResolvedValue(session);
      const req = new NextRequest('http://localhost/api/ntr/import/preview', { method: 'POST', body: new FormData() });
      const res = await previewPOST(req);
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.error.code).toBe('FORBIDDEN');
      expect(mockImportService.preview).not.toHaveBeenCalled();
    });

    it('rejects a request with no file even for SuperAdmin (past the permission gate)', async () => {
      vi.mocked(getSession).mockResolvedValue(superAdminSession);
      const req = new NextRequest('http://localhost/api/ntr/import/preview', { method: 'POST', body: new FormData() });
      const res = await previewPOST(req);
      expect(res.status).toBe(400);
      expect(mockImportService.preview).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/ntr/import/commit', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/ntr/import/commit', { method: 'POST', body: JSON.stringify({ sessionId: 'x' }) });
      const res = await commitPOST(req);
      expect(res.status).toBe(401);
      expect(mockImportService.commit).not.toHaveBeenCalled();
    });

    it.each([
      ['DealerAdmin', dealerAdminSession],
      ['CentralAdmin (MSEAL)', centralAdminSession],
    ])('returns 403 for %s', async (_label, session) => {
      vi.mocked(getSession).mockResolvedValue(session);
      const req = new NextRequest('http://localhost/api/ntr/import/commit', { method: 'POST', body: JSON.stringify({ sessionId: 'x' }) });
      const res = await commitPOST(req);
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.error.code).toBe('FORBIDDEN');
      expect(mockImportService.commit).not.toHaveBeenCalled();
    });

    it('proceeds to the service for SuperAdmin', async () => {
      vi.mocked(getSession).mockResolvedValue(superAdminSession);
      mockImportService.commit.mockResolvedValue({ id: 'sess-1', status: 'Completed' });
      const req = new NextRequest('http://localhost/api/ntr/import/commit', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }) });
      const res = await commitPOST(req);
      expect(res.status).toBe(200);
      expect(mockImportService.commit).toHaveBeenCalledWith('sess-1', { username: 'root' }, 'legacy');
    });
  });

  describe('GET /api/ntr/import/sessions', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      const res = await sessionsGET(new NextRequest('http://localhost/api/ntr/import/sessions'));
      expect(res.status).toBe(401);
      expect(mockImportService.listSessions).not.toHaveBeenCalled();
    });

    it.each([
      ['DealerAdmin', dealerAdminSession],
      ['CentralAdmin (MSEAL)', centralAdminSession],
    ])('returns 403 for %s', async (_label, session) => {
      vi.mocked(getSession).mockResolvedValue(session);
      const res = await sessionsGET(new NextRequest('http://localhost/api/ntr/import/sessions'));
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.error.code).toBe('FORBIDDEN');
      expect(mockImportService.listSessions).not.toHaveBeenCalled();
    });

    it('returns sessions for SuperAdmin', async () => {
      vi.mocked(getSession).mockResolvedValue(superAdminSession);
      mockImportService.listSessions.mockResolvedValue([]);
      const res = await sessionsGET(new NextRequest('http://localhost/api/ntr/import/sessions'));
      expect(res.status).toBe(200);
      expect(mockImportService.listSessions).toHaveBeenCalled();
    });
  });

  describe('GET /api/ntr/import/archive', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      const res = await archiveGET();
      expect(res.status).toBe(401);
      expect(mockImportService.listArchiveQueue).not.toHaveBeenCalled();
    });

    it.each([
      ['DealerAdmin', dealerAdminSession],
      ['CentralAdmin (MSEAL)', centralAdminSession],
    ])('returns 403 for %s', async (_label, session) => {
      vi.mocked(getSession).mockResolvedValue(session);
      const res = await archiveGET();
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.error.code).toBe('FORBIDDEN');
      expect(mockImportService.listArchiveQueue).not.toHaveBeenCalled();
    });

    it('returns the queue for SuperAdmin', async () => {
      vi.mocked(getSession).mockResolvedValue(superAdminSession);
      mockImportService.listArchiveQueue.mockResolvedValue([]);
      const res = await archiveGET();
      expect(res.status).toBe(200);
      expect(mockImportService.listArchiveQueue).toHaveBeenCalled();
    });
  });

  describe('POST /api/ntr/import/archive', () => {
    it('returns 401 when unauthenticated', async () => {
      vi.mocked(getSession).mockResolvedValue(null);
      const req = new NextRequest('http://localhost/api/ntr/import/archive', { method: 'POST', body: JSON.stringify({}) });
      const res = await archivePOST(req);
      expect(res.status).toBe(401);
      expect(mockImportService.processArchiveQueue).not.toHaveBeenCalled();
    });

    it.each([
      ['DealerAdmin', dealerAdminSession],
      ['CentralAdmin (MSEAL)', centralAdminSession],
    ])('returns 403 for %s', async (_label, session) => {
      vi.mocked(getSession).mockResolvedValue(session);
      const req = new NextRequest('http://localhost/api/ntr/import/archive', { method: 'POST', body: JSON.stringify({}) });
      const res = await archivePOST(req);
      const json = await res.json();
      expect(res.status).toBe(403);
      expect(json.error.code).toBe('FORBIDDEN');
      expect(mockImportService.processArchiveQueue).not.toHaveBeenCalled();
    });

    it('processes the queue for SuperAdmin', async () => {
      vi.mocked(getSession).mockResolvedValue(superAdminSession);
      mockImportService.processArchiveQueue.mockResolvedValue([]);
      const req = new NextRequest('http://localhost/api/ntr/import/archive', { method: 'POST', body: JSON.stringify({ sessionId: 'sess-1' }) });
      const res = await archivePOST(req);
      expect(res.status).toBe(200);
      expect(mockImportService.processArchiveQueue).toHaveBeenCalledWith({ username: 'root' }, 'sess-1');
    });
  });
});
