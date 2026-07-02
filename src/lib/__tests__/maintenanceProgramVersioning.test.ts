import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionUser } from '../types';

/**
 * Each table gets its own FIFO queue of `{data, error}` results, consumed
 * in call order - simplest way to mock a function that issues several
 * sequential, differently-shaped queries against the same table without
 * building a full fake query planner.
 */
function createTableMock() {
  const queues = new Map<string, { data: unknown; error: unknown }[]>();
  const inserts = new Map<string, unknown[][]>();
  const updates = new Map<string, unknown[]>();

  function queue(table: string, result: { data: unknown; error: unknown }) {
    if (!queues.has(table)) queues.set(table, []);
    queues.get(table)!.push(result);
  }

  const from = vi.fn((table: string) => {
    const chainMethods = ['select', 'eq', 'lte', 'order', 'limit', 'in'] as const;
    const builder: Record<string, unknown> = {};
    for (const method of chainMethods) {
      builder[method] = vi.fn(() => builder);
    }
    builder.maybeSingle = vi.fn(() => {
      const q = queues.get(table);
      const result = q && q.length > 0 ? q.shift()! : { data: null, error: null };
      return Promise.resolve(result);
    });
    builder.single = vi.fn(() => {
      const q = queues.get(table);
      const result = q && q.length > 0 ? q.shift()! : { data: null, error: null };
      return Promise.resolve(result);
    });
    builder.then = (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) => {
      const q = queues.get(table);
      const result = q && q.length > 0 ? q.shift()! : { data: [], error: null };
      return Promise.resolve(result).then(onFulfilled);
    };
    builder.insert = vi.fn((rows: unknown) => {
      if (!inserts.has(table)) inserts.set(table, []);
      inserts.get(table)!.push(Array.isArray(rows) ? rows : [rows]);
      const chained: Record<string, unknown> = {};
      chained.select = vi.fn(() => chained);
      chained.single = vi.fn(() => {
        const q = queues.get(`${table}:insert`);
        const result = q && q.length > 0 ? q.shift()! : { data: null, error: null };
        return Promise.resolve(result);
      });
      chained.then = (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled);
      return chained;
    });
    builder.update = vi.fn((patch: unknown) => {
      if (!updates.has(table)) updates.set(table, []);
      updates.get(table)!.push(patch);
      const chained: Record<string, unknown> = {};
      chained.eq = vi.fn(() => chained);
      chained.then = (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled);
      return chained;
    });
    return builder;
  });

  return { from, queue, inserts, updates };
}

let mock: ReturnType<typeof createTableMock>;

vi.mock('../supabase', () => ({
  getSupabase: () => ({ from: mock.from }),
}));

import { resolveVehicleProgramVersionStages, syncMaintenanceProgramVersion } from '../db';

const session: SessionUser = { username: 'alice', fullName: 'Alice', role: 'SuperAdmin', dealerId: null, branch: null };

describe('resolveVehicleProgramVersionStages', () => {
  beforeEach(() => {
    mock = createTableMock();
  });

  it('returns null when the family has no Maintenance Program version at all', async () => {
    mock.queue('vehicles', { data: { maintenance_program_version_id: null }, error: null }); // vehicles select
    mock.queue('maintenance_program_versions', { data: [], error: null }); // candidate lookup (<=asOf)
    mock.queue('maintenance_program_versions', { data: [], error: null }); // earliest fallback

    const result = await resolveVehicleProgramVersionStages('v1', 'family-1', '2026-01-01');
    expect(result).toBeNull();
  });

  it('pins to the version effective at the retail date and persists the pin', async () => {
    mock.queue('vehicles', { data: { maintenance_program_version_id: null }, error: null });
    mock.queue('maintenance_program_versions', {
      data: [{ id: 'version-A', effective_from: '2025-01-01T00:00:00Z' }],
      error: null,
    }); // candidate <= retail date
    mock.queue('maintenance_program_versions', { data: { id: 'version-A', version_number: 1 }, error: null }); // version row by id
    mock.queue('maintenance_program_version_stages', {
      data: [{ pm_interval_id: 'pmi-1', label: '50 Hr', interval_hours: 50, interval_months: null }],
      error: null,
    });

    const result = await resolveVehicleProgramVersionStages('v1', 'family-1', '2026-01-01');

    expect(result?.versionId).toBe('version-A');
    expect(result?.versionNumber).toBe(1);
    expect(result?.stages).toEqual([{ pmIntervalId: 'pmi-1', label: '50 Hr', intervalHours: 50, intervalMonths: null }]);
    expect(mock.updates.get('vehicles')?.[0]).toMatchObject({ maintenance_program_version_id: 'version-A' });
  });

  it('reuses an already-pinned version without re-pinning, when it still belongs to the same family', async () => {
    mock.queue('vehicles', { data: { maintenance_program_version_id: 'pinned-version' }, error: null });
    mock.queue('maintenance_program_versions', {
      data: { id: 'pinned-version', product_family_id: 'family-1' },
      error: null,
    }); // pin-belongs-to-family check
    mock.queue('maintenance_program_versions', { data: { id: 'pinned-version', version_number: 3 }, error: null }); // version row
    mock.queue('maintenance_program_version_stages', { data: [], error: null });

    const result = await resolveVehicleProgramVersionStages('v1', 'family-1', '2026-01-01');

    expect(result?.versionId).toBe('pinned-version');
    expect(mock.updates.get('vehicles')).toBeUndefined();
  });

  it('re-resolves when the pinned version belongs to a different (stale) family', async () => {
    mock.queue('vehicles', { data: { maintenance_program_version_id: 'stale-version' }, error: null });
    mock.queue('maintenance_program_versions', {
      data: { id: 'stale-version', product_family_id: 'OTHER_FAMILY' },
      error: null,
    }); // stale pin, family mismatch
    mock.queue('maintenance_program_versions', {
      data: [{ id: 'version-B', effective_from: '2025-06-01T00:00:00Z' }],
      error: null,
    }); // fresh candidate lookup for family-1
    mock.queue('maintenance_program_versions', { data: { id: 'version-B', version_number: 2 }, error: null });
    mock.queue('maintenance_program_version_stages', { data: [], error: null });

    const result = await resolveVehicleProgramVersionStages('v1', 'family-1', '2026-01-01');

    expect(result?.versionId).toBe('version-B');
    expect(mock.updates.get('vehicles')?.[0]).toMatchObject({ maintenance_program_version_id: 'version-B' });
  });
});

describe('syncMaintenanceProgramVersion', () => {
  beforeEach(() => {
    mock = createTableMock();
  });

  it('does nothing when no version exists yet and there are no live stages', async () => {
    mock.queue('maintenance_program_assignments', { data: [], error: null }); // listMaintenanceProgramStagesForFamily's assignment lookup
    mock.queue('maintenance_program_versions', { data: null, error: null }); // no current version

    await syncMaintenanceProgramVersion('family-1', session);

    expect(mock.inserts.get('maintenance_program_versions')).toBeUndefined();
  });

  it('creates version 1 when live stages exist and no version exists yet', async () => {
    mock.queue('maintenance_program_assignments', { data: [{ pm_interval_id: 'pmi-1' }], error: null });
    mock.queue('pm_intervals', {
      data: [{ id: 'pmi-1', label: '50 Hr', interval_hours: 50, interval_months: null }],
      error: null,
    });
    mock.queue('maintenance_program_versions', { data: null, error: null }); // no current version
    mock.queue('maintenance_program_versions:insert', { data: { id: 'new-version' }, error: null });

    await syncMaintenanceProgramVersion('family-1', session);

    const versionInserts = mock.inserts.get('maintenance_program_versions');
    expect(versionInserts?.[0][0]).toMatchObject({ product_family_id: 'family-1', version_number: 1, is_current: true });
    const stageInserts = mock.inserts.get('maintenance_program_version_stages');
    expect(stageInserts?.[0]).toEqual([
      { version_id: 'new-version', pm_interval_id: 'pmi-1', label: '50 Hr', interval_hours: 50, interval_months: null, display_order: 0 },
    ]);
  });

  it('is a no-op when the live stage set matches the current version snapshot exactly', async () => {
    mock.queue('maintenance_program_assignments', { data: [{ pm_interval_id: 'pmi-1' }], error: null });
    mock.queue('pm_intervals', {
      data: [{ id: 'pmi-1', label: '50 Hr', interval_hours: 50, interval_months: null }],
      error: null,
    });
    mock.queue('maintenance_program_versions', { data: { id: 'version-1', version_number: 1 }, error: null }); // current version
    mock.queue('maintenance_program_version_stages', {
      data: [{ pm_interval_id: 'pmi-1', label: '50 Hr', interval_hours: 50, interval_months: null }],
      error: null,
    });

    await syncMaintenanceProgramVersion('family-1', session);

    expect(mock.inserts.get('maintenance_program_versions')).toBeUndefined();
  });

  it('closes the old version and creates version 2 when live stages actually changed', async () => {
    mock.queue('maintenance_program_assignments', { data: [{ pm_interval_id: 'pmi-1' }], error: null });
    mock.queue('pm_intervals', {
      data: [{ id: 'pmi-1', label: '50 Hr', interval_hours: 75, interval_months: null }], // hours changed 50 -> 75
      error: null,
    });
    mock.queue('maintenance_program_versions', { data: { id: 'version-1', version_number: 1 }, error: null });
    mock.queue('maintenance_program_version_stages', {
      data: [{ pm_interval_id: 'pmi-1', label: '50 Hr', interval_hours: 50, interval_months: null }],
      error: null,
    });
    mock.queue('maintenance_program_versions:insert', { data: { id: 'version-2' }, error: null });

    await syncMaintenanceProgramVersion('family-1', session);

    expect(mock.updates.get('maintenance_program_versions')?.[0]).toMatchObject({ is_current: false });
    const versionInserts = mock.inserts.get('maintenance_program_versions');
    expect(versionInserts?.[0][0]).toMatchObject({ version_number: 2 });
  });
});
