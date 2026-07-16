import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getSession: vi.fn(),
}));

const mockAssertBranchAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/dealerBranchScope', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/dealerBranchScope')>();
  return { ...actual, assertBranchAccess: mockAssertBranchAccess };
});

const mockCreate = vi.fn();
vi.mock('@/features/ntr/factory', () => ({
  createNtrService: () => ({ create: mockCreate }),
}));

vi.mock('@/shared/attachments', () => ({
  AttachmentService: vi.fn().mockImplementation(() => ({
    reassignEntity: vi.fn(),
    markBusinessComplete: vi.fn(),
  })),
}));

const mockRunNtrWarrantyOrchestration = vi.fn().mockResolvedValue(undefined);
vi.mock('@/features/ntr/services/ntrPostCreateOrchestration', () => ({
  runNtrWarrantyOrchestration: mockRunNtrWarrantyOrchestration,
}));

const { getSession } = await import('@/lib/auth');
const { POST } = await import('./route');

function session(overrides: Record<string, unknown> = {}) {
  return {
    username: 'alice',
    fullName: 'Alice',
    role: 'DealerUser' as const,
    dealerId: 'D1',
    branch: null,
    branchId: null,
    sessionId: 'test-session',
    forcePasswordChange: false,
    ...overrides,
  };
}

const validBody = {
  branch_id: null,
  serial: 'SN-1',
  salesperson: 'Somchai Sales',
  customer_name: 'Somchai',
  customer_phone: '0812345678',
  delivery_date: '2026-01-01',
  photo_customer_id_url: 'https://example.com/a.jpg',
  photo_serial_plate_url: 'https://example.com/b.jpg',
  photo_hour_meter_url: 'https://example.com/c.jpg',
  photo_signed_document_url: 'https://example.com/d.jpg',
};

function postRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/ntr-records', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/ntr-records — Dealer/Branch Scope authorization', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockAssertBranchAccess.mockReset().mockResolvedValue(undefined);
    mockRunNtrWarrantyOrchestration.mockReset().mockResolvedValue(undefined);
    mockCreate.mockResolvedValue({
      id: 'ntr-1',
      dealer_id: 'D1',
      serial: 'SN-1',
      delivery_date: '2026-01-01',
      product_family_id: 'PF-1',
      retail_date: null,
      photo_customer_id_attachment_id: null,
      photo_customer_tractor_attachment_id: null,
      photo_serial_plate_attachment_id: null,
      photo_hour_meter_attachment_id: null,
      photo_signed_document_attachment_id: null,
      video_attachment_id: null,
      additional_photos: [],
    });
  });

  it('DealerUser is pinned to their own session dealer_id, ignoring any dealer_id in the body', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'DealerUser', dealerId: 'D1' }));
    const res = await POST(postRequest({ ...validBody, dealer_id: 'OTHER_DEALER' }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ dealer_id: 'D1' }), expect.anything());
  });

  it('DealerAdmin is pinned to their own session dealer_id too', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'DealerAdmin', dealerId: 'D1' }));
    const res = await POST(postRequest({ ...validBody, dealer_id: 'OTHER_DEALER' }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ dealer_id: 'D1' }), expect.anything());
  });

  it('SuperAdmin may set an arbitrary dealer_id', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'SuperAdmin', dealerId: null }));
    const res = await POST(postRequest({ ...validBody, dealer_id: 'D9' }));
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ dealer_id: 'D9' }), expect.anything());
  });

  it('SuperAdmin without a dealer_id is rejected (not silently defaulted)', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'SuperAdmin', dealerId: null }));
    const res = await POST(postRequest({ ...validBody, dealer_id: undefined }));
    expect(res.status).toBe(400);
  });

  it('rejects a branch_id that does not belong to the resolved dealer_id', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'SuperAdmin', dealerId: null }));
    mockAssertBranchAccess.mockRejectedValue(new Error('FORBIDDEN_BRANCH'));
    const res = await POST(postRequest({ ...validBody, dealer_id: 'D9', branch_id: 'foreign-branch' }));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error.message).toMatch(/branch_id does not belong/);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('POST /api/ntr-records — NTR post-create Warranty/vehicle/PM orchestration (ADR-028)', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockAssertBranchAccess.mockReset().mockResolvedValue(undefined);
    mockRunNtrWarrantyOrchestration.mockReset().mockResolvedValue(undefined);
    mockCreate.mockResolvedValue({
      id: 'ntr-1',
      dealer_id: 'D1',
      serial: 'SN-1',
      delivery_date: '2026-01-01',
      product_family_id: 'PF-1',
      retail_date: null,
      photo_customer_id_attachment_id: null,
      photo_customer_tractor_attachment_id: null,
      photo_serial_plate_attachment_id: null,
      photo_hour_meter_attachment_id: null,
      photo_signed_document_attachment_id: null,
      video_attachment_id: null,
      additional_photos: [],
    });
  });

  it('runs the shared orchestration exactly once, with the created record and the actor, after a successful create', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'DealerUser', dealerId: 'D1' }));
    const res = await POST(postRequest(validBody));

    expect(res.status).toBe(201);
    expect(mockRunNtrWarrantyOrchestration).toHaveBeenCalledTimes(1);
    expect(mockRunNtrWarrantyOrchestration).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ntr-1', serial: 'SN-1', delivery_date: '2026-01-01', product_family_id: 'PF-1' }),
      { username: 'alice', role: 'DealerUser' }
    );
  });

  it('never fails the NTR create response when the orchestration itself rejects (non-blocking by design)', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'DealerUser', dealerId: 'D1' }));
    mockRunNtrWarrantyOrchestration.mockRejectedValue(new Error('warranty orchestration exploded'));

    const res = await POST(postRequest(validBody));

    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('does not run the orchestration at all when NTR creation itself fails', async () => {
    vi.mocked(getSession).mockResolvedValue(session({ role: 'DealerUser', dealerId: 'D1' }));
    mockCreate.mockRejectedValue(new Error('duplicate'));

    await POST(postRequest(validBody));

    expect(mockRunNtrWarrantyOrchestration).not.toHaveBeenCalled();
  });
});
