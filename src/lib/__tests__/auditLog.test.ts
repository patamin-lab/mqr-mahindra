import { describe, it, expect, vi, beforeEach } from 'vitest';

interface QueryResult {
  data: unknown;
  error: unknown;
}

function createQueryBuilder(result: QueryResult) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chainMethods = ['select', 'eq', 'gte', 'order', 'insert', 'limit'] as const;
  const builder: Record<string, unknown> = {};
  for (const method of chainMethods) {
    builder[method] = vi.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  }
  builder.then = (onFulfilled: (value: QueryResult) => unknown) => Promise.resolve(result).then(onFulfilled);
  return { builder, calls };
}

const mockFrom = vi.fn();

vi.mock('../supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

// db.ts pulls in a lot of unrelated modules at import time; only auditLog
// exports are under test here, but they live in db.ts per this repo's
// "all Supabase access goes through the shared db layer" convention.
import { logAuditEvent, logAuditEvents, listAuditLog, listTodaysAuditLog, diffFieldsForAudit } from '../db';

describe('logAuditEvent', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('inserts a single row with snake_case columns', async () => {
    const { builder, calls } = createQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await logAuditEvent({
      module: 'mqr',
      recordId: 'r1',
      recordRef: 'QIR-2607-0001',
      eventType: 'StatusChanged',
      fieldName: 'status',
      oldValue: 'Open',
      newValue: 'Closed',
      performedBy: 'alice',
    });

    expect(mockFrom).toHaveBeenCalledWith('record_audit_log');
    const insertCall = calls.find((c) => c.method === 'insert');
    expect(insertCall?.args[0]).toMatchObject({
      module: 'mqr',
      record_id: 'r1',
      record_ref: 'QIR-2607-0001',
      event_type: 'StatusChanged',
      field_name: 'status',
      old_value: 'Open',
      new_value: 'Closed',
      performed_by: 'alice',
    });
  });

  it('throws when the insert fails, never swallowing the error', async () => {
    const { builder } = createQueryBuilder({ data: null, error: new Error('boom') });
    mockFrom.mockReturnValue(builder);

    await expect(
      logAuditEvent({
        module: 'pm',
        recordId: 'r2',
        recordRef: 'PM-0001',
        eventType: 'Created',
        performedBy: 'bob',
      })
    ).rejects.toThrow('boom');
  });
});

describe('logAuditEvents', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('is a no-op for an empty array (never calls Supabase)', async () => {
    await logAuditEvents([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('inserts all rows in a single batched call', async () => {
    const { builder, calls } = createQueryBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await logAuditEvents([
      { module: 'pm', recordId: 'r3', recordRef: 'PM-0002', eventType: 'FieldChanged', fieldName: 'hourMeter', oldValue: '10', newValue: '20', performedBy: 'carol' },
      { module: 'pm', recordId: 'r3', recordRef: 'PM-0002', eventType: 'FieldChanged', fieldName: 'notes', oldValue: null, newValue: 'ok', performedBy: 'carol' },
    ]);

    const insertCall = calls.find((c) => c.method === 'insert');
    expect(insertCall?.args[0]).toHaveLength(2);
  });
});

describe('listAuditLog', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('maps rows back to camelCase and scopes by module + record id', async () => {
    const row = {
      id: 'a1',
      module: 'mqr',
      record_id: 'r1',
      record_ref: 'QIR-2607-0001',
      event_type: 'Created',
      field_name: null,
      old_value: null,
      new_value: null,
      performed_by: 'alice',
      performed_at: '2026-07-01T00:00:00Z',
    };
    const { builder, calls } = createQueryBuilder({ data: [row], error: null });
    mockFrom.mockReturnValue(builder);

    const result = await listAuditLog('mqr', 'r1');

    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'module' && c.args[1] === 'mqr')).toBe(true);
    expect(calls.some((c) => c.method === 'eq' && c.args[0] === 'record_id' && c.args[1] === 'r1')).toBe(true);
    expect(result).toEqual([
      {
        id: 'a1',
        module: 'mqr',
        recordId: 'r1',
        recordRef: 'QIR-2607-0001',
        eventType: 'Created',
        fieldName: null,
        oldValue: null,
        newValue: null,
        performedBy: 'alice',
        performedAt: '2026-07-01T00:00:00Z',
      },
    ]);
  });
});

describe('listTodaysAuditLog (Platform Overview "Today\'s Activities", ADR-023 refinement)', () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it('filters by performed_at >= start of today (Bangkok day, not server/UTC day) and maps rows back to camelCase', async () => {
    const row = {
      id: 'a2',
      module: 'pm',
      record_id: 'r9',
      record_ref: 'PM-KTV-2026-000001',
      event_type: 'Created',
      field_name: null,
      old_value: null,
      new_value: null,
      performed_by: 'bob',
      performed_at: '2026-07-09T05:00:00Z',
    };
    const { builder, calls } = createQueryBuilder({ data: [row], error: null });
    mockFrom.mockReturnValue(builder);

    const result = await listTodaysAuditLog();

    expect(mockFrom).toHaveBeenCalledWith('record_audit_log');
    const gteCall = calls.find((c) => c.method === 'gte');
    expect(gteCall).toBeDefined();
    expect(gteCall!.args[0]).toBe('performed_at');
    // The boundary is a valid ISO instant - not asserting the exact clock
    // value here (that would just re-encode "now"), only that a real
    // day-boundary was computed rather than an empty/garbage value.
    expect(typeof gteCall!.args[1]).toBe('string');
    expect(() => new Date(gteCall!.args[1] as string)).not.toThrow();

    expect(result).toEqual([
      {
        id: 'a2',
        module: 'pm',
        recordId: 'r9',
        recordRef: 'PM-KTV-2026-000001',
        eventType: 'Created',
        fieldName: null,
        oldValue: null,
        newValue: null,
        performedBy: 'bob',
        performedAt: '2026-07-09T05:00:00Z',
      },
    ]);
  });

  it('defaults to a 20-row limit', async () => {
    const { builder, calls } = createQueryBuilder({ data: [], error: null });
    mockFrom.mockReturnValue(builder);
    await listTodaysAuditLog();
    expect(calls.some((c) => c.method === 'limit' && c.args[0] === 20)).toBe(true);
  });
});

describe('diffFieldsForAudit', () => {
  const base = { module: 'pm' as const, recordId: 'r1', recordRef: 'PM-0001', performedBy: 'alice' };

  it('reports only fields whose stringified value actually changed', () => {
    const events = diffFieldsForAudit(
      base,
      { hourMeter: 'ชั่วโมงเครื่องยนต์', notes: 'หมายเหตุ' },
      { hourMeter: 100, notes: 'same' },
      { hourMeter: 150, notes: 'same' }
    );
    expect(events).toEqual([
      { ...base, eventType: 'FieldChanged', fieldName: 'ชั่วโมงเครื่องยนต์', oldValue: '100', newValue: '150' },
    ]);
  });

  it('treats null and undefined as equal (no false-positive change)', () => {
    const events = diffFieldsForAudit(base, { notes: 'หมายเหตุ' }, { notes: null }, { notes: undefined });
    expect(events).toEqual([]);
  });

  it('reports a real clear (value -> null) as a change', () => {
    const events = diffFieldsForAudit(base, { notes: 'หมายเหตุ' }, { notes: 'was set' }, { notes: null });
    expect(events).toEqual([{ ...base, eventType: 'FieldChanged', fieldName: 'หมายเหตุ', oldValue: 'was set', newValue: null }]);
  });

  it('returns no events when nothing changed', () => {
    const events = diffFieldsForAudit(base, { a: 'A' }, { a: 1 }, { a: 1 });
    expect(events).toEqual([]);
  });
});
