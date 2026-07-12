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

  it('re-sorts newest-first across modules, not just within each module', async () => {
    mockAuditLogTable({
      mqr: [{ id: 'old-mqr', module: 'mqr', record_id: 'R1', record_ref: 'QIR-1', event_type: 'field_change', field_name: 'status', old_value: null, new_value: null, performed_by: 'alice', performed_at: '2026-01-01T00:00:00Z' }],
      pm: [{ id: 'new-pm', module: 'pm', record_id: 'R2', record_ref: 'PM-1', event_type: 'field_change', field_name: 'hour_meter', old_value: null, new_value: null, performed_by: 'bob', performed_at: '2026-06-01T00:00:00Z' }],
    });

    const result = await listAuditLogForRecords([
      { module: 'mqr', recordId: 'R1' },
      { module: 'pm', recordId: 'R2' },
    ]);

    expect(result.map((r) => r.id)).toEqual(['new-pm', 'old-mqr']);
  });

  it('caps the combined result at 300 across all modules, not 300 per module', async () => {
    // Each row's `performed_at` is `daysAgo` days before a fixed reference
    // instant, so ordering is unambiguous regardless of month/year rollover.
    const reference = Date.UTC(2026, 5, 1); // 2026-06-01
    const makeRows = (module: string, count: number, startDaysAgo: number) =>
      Array.from({ length: count }, (_, i) => ({
        id: `${module}-${i}`,
        module,
        record_id: 'R1',
        record_ref: `${module.toUpperCase()}-1`,
        event_type: 'field_change',
        field_name: 'status',
        old_value: null,
        new_value: null,
        performed_by: 'alice',
        // Newest first, matching the query's own `.order('performed_at', { ascending: false })`.
        performed_at: new Date(reference - (startDaysAgo + i) * 86400000).toISOString(),
      }));

    mockAuditLogTable({
      // mqr alone hits the per-query cap (300) - its own oldest rows beyond
      // that are never even fetched, which is expected and unrelated to
      // this test's actual assertion (the cross-module merge/cap). Starts
      // 10 days ago so every mqr row is older than every pm row below.
      mqr: makeRows('mqr', 300, 10),
      // pm has far fewer rows, all newer (0-4 days ago) than any mqr row.
      pm: makeRows('pm', 5, 0),
    });

    const result = await listAuditLogForRecords([
      { module: 'mqr', recordId: 'R1' },
      { module: 'pm', recordId: 'R1' },
    ]);

    expect(result).toHaveLength(300);
    // The 5 newer pm rows must survive the combined cap - a per-module cap
    // would have kept all 300 mqr rows and dropped nothing from pm anyway
    // (this fixture doesn't exercise that distinction), but a *correct*
    // global newest-300 cutoff must still put pm's newer rows ahead of
    // mqr's oldest ones in the final, sorted, capped result.
    expect(result.filter((r) => r.module === 'pm')).toHaveLength(5);
    expect(result[0].module).toBe('pm');
  });
});
