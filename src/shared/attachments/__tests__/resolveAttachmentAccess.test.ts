import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionUser } from '@/lib/types';

const mockGetRecordByJobId = vi.fn();
vi.mock('@/lib/db', () => ({
  getRecordByJobId: (...args: unknown[]) => mockGetRecordByJobId(...args),
}));

const mockNtrGetById = vi.fn();
vi.mock('@/features/ntr/repositories/supabaseNtrRepository', () => ({
  SupabaseNtrRepository: vi.fn().mockImplementation(function () {
    return { getById: mockNtrGetById };
  }),
}));

const mockPmGetById = vi.fn();
vi.mock('@/features/maintenance/repositories/supabaseMaintenanceRepository', () => ({
  SupabaseMaintenanceRepository: vi.fn().mockImplementation(function () {
    return { getById: mockPmGetById };
  }),
}));

const mockGetDelivery = vi.fn();
vi.mock('@/features/delivery/service', () => ({
  DeliveryService: vi.fn().mockImplementation(function () {
    return { getDelivery: mockGetDelivery };
  }),
}));

const { canAccessAttachment } = await import('../resolveAttachmentAccess');

function session(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    username: 'alice',
    fullName: 'Alice',
    role: 'DealerUser',
    dealerId: 'D1',
    branch: null,
    branchId: 'B1',
    sessionId: 'test-session',
    forcePasswordChange: false,
    ...overrides,
  } as SessionUser;
}

/**
 * Production regression audit (2026-07-18): the Attachment Platform had no
 * dealer/branch scope check at all - any authenticated user could read/
 * delete/reassign any attachment by ID or discover another dealer's
 * attachments via a guessable entityId. `canAccessAttachment()` closes
 * this by re-checking the owning record through each module's own
 * already-scope-safe accessor. These tests pin that behavior per module so
 * a future change to any of the underlying accessors can't silently
 * reopen the gap.
 */
describe('canAccessAttachment', () => {
  beforeEach(() => {
    mockGetRecordByJobId.mockReset();
    mockNtrGetById.mockReset();
    mockPmGetById.mockReset();
    mockGetDelivery.mockReset();
  });

  describe('module: mqr', () => {
    it('allows access when getRecordByJobId resolves a record (in-scope)', async () => {
      mockGetRecordByJobId.mockResolvedValue({ id: 'r1', job_id: 'MQR-1' });
      const result = await canAccessAttachment({ module: 'mqr', entityId: 'MQR-1' }, session());
      expect(result).toBe(true);
      expect(mockGetRecordByJobId).toHaveBeenCalledWith('MQR-1', expect.objectContaining({ username: 'alice' }));
    });

    it('denies access when getRecordByJobId returns null (out of scope or not found)', async () => {
      mockGetRecordByJobId.mockResolvedValue(null);
      const result = await canAccessAttachment({ module: 'mqr', entityId: 'MQR-OTHER-DEALER' }, session());
      expect(result).toBe(false);
    });
  });

  describe('module: ntr', () => {
    it('allows access when the NTR repository resolves the record', async () => {
      mockNtrGetById.mockResolvedValue({ id: 'ntr-1' });
      const result = await canAccessAttachment({ module: 'ntr', entityId: 'ntr-1' }, session());
      expect(result).toBe(true);
      expect(mockNtrGetById).toHaveBeenCalledWith('ntr-1', expect.objectContaining({ username: 'alice' }));
    });

    it('denies access when the NTR repository returns null', async () => {
      mockNtrGetById.mockResolvedValue(null);
      const result = await canAccessAttachment({ module: 'ntr', entityId: 'ntr-other' }, session());
      expect(result).toBe(false);
    });
  });

  describe('module: pm', () => {
    it('allows access when the Maintenance repository resolves the record', async () => {
      mockPmGetById.mockResolvedValue({ id: 'pm-1' });
      const result = await canAccessAttachment({ module: 'pm', entityId: 'pm-1' }, session());
      expect(result).toBe(true);
      expect(mockPmGetById).toHaveBeenCalledWith('pm-1', expect.objectContaining({ username: 'alice' }));
    });

    it('denies access when the Maintenance repository returns null', async () => {
      mockPmGetById.mockResolvedValue(null);
      const result = await canAccessAttachment({ module: 'pm', entityId: 'pm-other' }, session());
      expect(result).toBe(false);
    });
  });

  describe('module: delivery', () => {
    it('allows access when the delivery belongs to the same dealer', async () => {
      mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
      const result = await canAccessAttachment({ module: 'delivery', entityId: 'del-1' }, session({ dealerId: 'D1' }));
      expect(result).toBe(true);
    });

    it('denies access when the delivery belongs to a different dealer', async () => {
      mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
      const result = await canAccessAttachment({ module: 'delivery', entityId: 'del-1' }, session({ dealerId: 'D2' }));
      expect(result).toBe(false);
    });

    it('allows a SuperAdmin across dealers', async () => {
      mockGetDelivery.mockResolvedValue({ id: 'del-1', dealerId: 'D1' });
      const result = await canAccessAttachment(
        { module: 'delivery', entityId: 'del-1' },
        session({ role: 'SuperAdmin', dealerId: null })
      );
      expect(result).toBe(true);
    });

    it('denies access when the delivery record does not exist', async () => {
      mockGetDelivery.mockRejectedValue(new Error('Delivery record del-1 not found'));
      const result = await canAccessAttachment({ module: 'delivery', entityId: 'del-1' }, session());
      expect(result).toBe(false);
    });
  });

  describe('module: pdi', () => {
    it('allows MSEAL roles (CentralAdmin/SuperAdmin)', async () => {
      expect(await canAccessAttachment({ module: 'pdi', entityId: 'insp-1' }, session({ role: 'CentralAdmin', dealerId: null }))).toBe(true);
      expect(await canAccessAttachment({ module: 'pdi', entityId: 'insp-1' }, session({ role: 'SuperAdmin', dealerId: null }))).toBe(true);
    });

    it('denies dealer roles (Import Inspection is never dealer-visible in detail, ADR-028)', async () => {
      expect(await canAccessAttachment({ module: 'pdi', entityId: 'insp-1' }, session({ role: 'DealerAdmin' }))).toBe(false);
      expect(await canAccessAttachment({ module: 'pdi', entityId: 'insp-1' }, session({ role: 'DealerUser' }))).toBe(false);
    });
  });

  describe('module: knowledge', () => {
    it('allows any authenticated role (Knowledge is an intentionally cross-dealer shared base)', async () => {
      expect(await canAccessAttachment({ module: 'knowledge', entityId: 'case-1' }, session({ role: 'DealerUser' }))).toBe(true);
    });
  });

  describe('unrecognized module', () => {
    it('fails closed', async () => {
      const result = await canAccessAttachment({ module: 'unknown-future-module', entityId: 'x' }, session());
      expect(result).toBe(false);
    });
  });
});
