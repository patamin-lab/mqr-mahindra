import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFrom = vi.fn();
vi.mock('./supabase', () => ({
  getSupabase: () => ({ from: mockFrom }),
}));

import { listAuditLogForRecords } from './db';

beforeEach(() => {
  mockFrom.mockReset();
});

function mockAuditLogTable(rowsByModule: Record<string, any[]>) {
  mockFrom.mockImplementation((table: string) => {
    if (table !== 'record_audit_log') throw new Error(`unexpected table: ${table}`);
    const builder: Record<string, unknown> = {};
    let moduleFilter: string | null = null;
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn((_col: string, value: string) => {
      moduleFilter = value;
      return builder;
    });
    builder.in = vi.fn(() => builder);
    builder.order = vi.fn(() => builder);
    builder.limit = vi.fn(() =>
      Promise.resolve({ data: rowsByModule[moduleFilter ?? ''] ?? [], error: null })
    );
    return builder;
  });
}

describe('listAuditLogForRecords (Machine Digital Passport - Machine Timeline)', () => {
  it('returns [] without querying Supabase when given no record refs', async () => {
    const result = await listAuditLogForRecords([]);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('groups refs by module and issues one query per module, mapping rows to the shared AuditLogEntry shape', async () => {
    mockAuditLogTable({
      mqr: [
        {
          id: 'A1',
          module: 'mqr',
          record_id: 'R1',
          record_ref: 'QIR-1',
          event_type: 'field_change',
          field_name: 'status',
          old_value: 'Open',
          new_value: 'Closed',
          performed_by: 'alice',
          performed_at: '2026-01-01T00:00:00Z',
        },
      ],
      pm: [
        {
          id: 'A2',
          module: 'pm',
          record_id: 'R2',
          record_ref: 'PM-1',
          event_type: 'field_change',
          field_name: 'hour_meter',
          old_value: '100',
          new_value: '150',
          performed_by: 'bob',
          performed_at: '2026-01-02T00:00:00Z',
        },
      ],
    });

    const result = await listAuditLogForRecords([
      { module: 'mqr', recordId: 'R1' },
      { module: 'pm', recordId: 'R2' },
    ]);

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.id).sort()).toEqual(['A1', 'A2']);
    expect(result.find((r) => r.id === 'A1')).toMatchObject({
      module: 'mqr',
      recordId: 'R1',
      recordRef: 'QIR-1',
      fieldName: 'status',
      oldValue: 'Open',
      newValue: 'Closed',
      performedBy: 'alice',
    });
  });

  it('batches multiple record ids for the same module into a single query', async () => {
    mockAuditLogTable({ mqr: [] });

    await listAuditLogForRecords([
      { module: 'mqr', recordId: 'R1' },
      { module: 'mqr', recordId: 'R2' },
      { module: 'mqr', recordId: 'R3' },
    ]);

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
