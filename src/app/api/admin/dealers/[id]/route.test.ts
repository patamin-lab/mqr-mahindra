import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

// PGRST116 is PostgREST's real shape for "no rows returned from .single()" -
// this is what Supabase actually throws for a PATCH against a non-existent
// id, not a hand-picked test fixture.
const pgrst116 = { code: 'PGRST116', message: 'The result contains 0 rows' };

vi.mock('@/lib/db', () => ({
  updateDealer: vi.fn().mockRejectedValue(pgrst116),
}));

const { getSession } = await import('@/lib/auth');
const { PATCH } = await import('./route');

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

/** Production regression audit (2026-07-18): PATCHing a non-existent
 *  dealer id previously fell through the generic catch block into an
 *  opaque HTTP 500 ("เกิดข้อผิดพลาดในระบบ") instead of a 404 - the same
 *  defect existed identically on problem-codes/pm-intervals/product-
 *  families. This pins the fix for one representative route; the other
 *  three apply the identical one-line `PGRST116` check. */
describe('PATCH /api/admin/dealers/[id] - non-existent id', () => {
  it('returns 404, not 500, when the dealer id does not exist', async () => {
    (getSession as any).mockResolvedValue(superAdminSession);

    const req = new NextRequest('http://localhost/api/admin/dealers/00000000-0000-0000-0000-000000000000', {
      method: 'PATCH',
      body: JSON.stringify({ active: false }),
    });
    const res = await PATCH(req, { params: { id: '00000000-0000-0000-0000-000000000000' } });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });
});
