import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '../types';

function makeRecordsBuilder(existingRow: Record<string, unknown>, updatedRow: Record<string, unknown>) {
  const chainMethods = ['select', 'eq', 'order', 'update'] as const;
  const builder: Record<string, unknown> = {};
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: existingRow, error: null });
  builder.single = vi.fn().mockResolvedValue({ data: updatedRow, error: null });
  return builder;
}

function makeAuditLogBuilder() {
  const inserted: unknown[][] = [];
  const builder: Record<string, unknown> = {
    insert: vi.fn((rows: unknown[]) => {
      inserted.push(rows);
      return Promise.resolve({ data: null, error: null });
    }),
  };
  return { builder, inserted };
}

const mockFrom = vi.fn();

vi.mock('../supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

import { updateRecord } from '../db';

const session: SessionUser = {
  username: 'alice',
  fullName: 'Alice',
  role: 'DealerAdmin',
  dealerId: 'D1',
  branch: null,
  branchId: null,
  sessionId: 'test-session',
  forcePasswordChange: false,
};

describe('updateRecord', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('rejects an invalid status transition and never writes to the DB', async () => {
    const existingRow = {
      id: 'r1',
      job_id: 'QIR-2607-0001',
      dealer_id: 'D1',
      created_by: 'alice',
      status: 'Draft',
      record_status: 'Active',
      photo_links: [],
    };
    const recordsBuilder = makeRecordsBuilder(existingRow, existingRow);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'records') return recordsBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    await expect(updateRecord('QIR-2607-0001', { status: 'Closed' }, session)).rejects.toThrow(
      /ไม่สามารถเปลี่ยนสถานะ/
    );
    expect(recordsBuilder.update).not.toHaveBeenCalled();
  });

  it('applies a valid transition and logs a StatusChanged audit event', async () => {
    const existingRow = {
      id: 'r1',
      job_id: 'QIR-2607-0001',
      dealer_id: 'D1',
      created_by: 'alice',
      status: 'Open',
      severity: 'Minor',
      record_status: 'Active',
      photo_links: [],
    };
    const updatedRow = { ...existingRow, status: 'UnderInvestigation' };
    const recordsBuilder = makeRecordsBuilder(existingRow, updatedRow);
    const { builder: auditBuilder, inserted } = makeAuditLogBuilder();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'records') return recordsBuilder;
      if (table === 'record_audit_log') return auditBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    const result = await updateRecord('QIR-2607-0001', { status: 'UnderInvestigation' }, session);

    expect(result.status).toBe('UnderInvestigation');
    expect(inserted).toHaveLength(1);
    const events = inserted[0] as any[];
    expect(events).toEqual([
      expect.objectContaining({
        module: 'mqr',
        event_type: 'StatusChanged',
        old_value: 'เปิดเรื่อง',
        new_value: 'กำลังตรวจสอบ',
        performed_by: 'alice',
      }),
    ]);
  });

  it('SuperAdmin may force an otherwise-invalid transition', async () => {
    const existingRow = {
      id: 'r1',
      job_id: 'QIR-2607-0001',
      dealer_id: 'D1',
      created_by: 'alice',
      status: 'Closed',
      record_status: 'Active',
      photo_links: [],
    };
    const updatedRow = { ...existingRow, status: 'Open' };
    const recordsBuilder = makeRecordsBuilder(existingRow, updatedRow);
    const { builder: auditBuilder } = makeAuditLogBuilder();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'records') return recordsBuilder;
      if (table === 'record_audit_log') return auditBuilder;
      throw new Error(`unexpected table ${table}`);
    });

    const superSession: SessionUser = { ...session, role: 'SuperAdmin' };
    const result = await updateRecord('QIR-2607-0001', { status: 'Open' }, superSession);
    expect(result.status).toBe('Open');
    expect(recordsBuilder.update).toHaveBeenCalled();
  });
});
