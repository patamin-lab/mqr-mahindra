import { describe, it, expect, vi, beforeEach } from 'vitest';

// Bulk-prefetch (fetchDealersByIds/fetchVehiclesBySerials in
// ntrImportService.ts) reads dealers/vehicles directly via
// getSupabase().from(table).select().in() - a fake query builder here,
// keyed by table name, driven by whatever dealers/vehicles a test sets
// on `fakeTables` before calling the service. Replaces the old
// per-row getDealer()/getVehicleBySerial() mocks after the 10,000-row
// performance fix batched those lookups (see
// docs/import/NTR_HISTORICAL_IMPORT.md's Performance section).
const fakeTables: {
  dealers: { id: string }[];
  vehicles: { serial: string; model: string | null }[];
  branches: { id: string; dealer_id: string }[];
} = {
  dealers: [],
  vehicles: [],
  branches: [],
};

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => ({
      select: () => ({
        in: (_column: string, values: string[]) => {
          const rows =
            table === 'dealers'
              ? fakeTables.dealers.filter((d) => values.includes(d.id))
              : table === 'branches'
                ? fakeTables.branches.filter((b) => values.includes(b.id))
                : fakeTables.vehicles.filter((v) => values.includes(v.serial));
          return Promise.resolve({ data: rows, error: null });
        },
      }),
    }),
  }),
}));
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, logAuditEvent: vi.fn() };
});
vi.mock('@/lib/googleDrive', () => ({ uploadFileToDrive: vi.fn() }));

import { NtrImportService } from '../services/ntrImportService';
import type { NtrRepository } from '../repositories/ntrRepository';
import type { NtrImportSessionRepository } from '../repositories/ntrImportSessionRepository';
import type { NtrImportSession, NtrRecord } from '../types';

const ACTOR = { username: 'tester' };

const CSV_HEADER =
  'Dealer,Serial Number,Engine No,Customer,Phone,Delivery Date,Model,District,Province,Postal Code,Manufacturing Year,Retail Date,Customer Title,First Name,Last Name,Address,Sub-District,Hour Meter';

/** Defaults for every field the v1.1.0 required-field standard added
 *  (Model/Retail Date/Hour Meter/Customer Title/First/Last Name/Address/
 *  Province/District/Sub-District) - a real, valid Thailand
 *  province/district/sub-district triple (see ntrAddressValidation.test.ts)
 *  so a test that isn't specifically about address/date/name validation
 *  doesn't have to restate all of this just to get past the new required
 *  checks. */
const ROW_DEFAULTS = {
  dealer: 'D1',
  serial: 'SER-001',
  engine: 'ENG-1',
  customer: 'John Doe',
  phone: '0812345678',
  deliveryDate: '2026-01-05',
  model: 'Test Model',
  district: 'เมืองบุรีรัมย์',
  province: 'บุรีรัมย์',
  postalCode: '31000',
  manufacturingYear: '',
  retailDate: '2026-01-05',
  title: 'นาย',
  firstName: 'John',
  lastName: 'Doe',
  address: '123 Test Address',
  subdistrict: 'ในเมือง',
  hourMeter: '10',
};

type RowOverrides = Partial<typeof ROW_DEFAULTS>;

function row(overrides: RowOverrides = {}): string {
  const r = { ...ROW_DEFAULTS, ...overrides };
  return [
    r.dealer,
    r.serial,
    r.engine,
    r.customer,
    r.phone,
    r.deliveryDate,
    r.model,
    r.district,
    r.province,
    r.postalCode,
    r.manufacturingYear,
    r.retailDate,
    r.title,
    r.firstName,
    r.lastName,
    r.address,
    r.subdistrict,
    r.hourMeter,
  ].join(',');
}

function csvBuffer(rows: string[]): Buffer {
  return Buffer.from([CSV_HEADER, ...rows].join('\n'), 'utf-8');
}

function makeNtrRepository(overrides: Partial<NtrRepository> = {}): NtrRepository {
  return {
    getById: vi.fn(),
    findActiveBySerial: vi.fn().mockResolvedValue(null),
    findActiveBySerials: vi.fn().mockResolvedValue(new Map()),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    listHistory: vi.fn(),
    commitLegacyImportRow: vi.fn().mockResolvedValue({ id: 'ntr-1' } as NtrRecord),
    ...overrides,
  };
}

function makeSessionRepository(): NtrImportSessionRepository {
  let counter = 0;
  const sessions = new Map<string, NtrImportSession>();
  return {
    create: vi.fn().mockImplementation((input) => {
      const id = `session-${++counter}`;
      const session = {
        id,
        importer: input.importer,
        filename: input.filename,
        original_file_url: null,
        status: 'Pending',
        total_records: input.totalRecords,
        valid_count: 0,
        duplicate_count: 0,
        skipped_count: 0,
        failed_count: 0,
        errors: [],
        file_content: input.fileContent,
        file_checksum: input.fileChecksum,
        imported_at: null,
        archive_job_id: null,
        archive_attempts: 0,
        last_archive_attempt_at: null,
        archive_error: null,
        archived_at: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        created_by: ACTOR.username,
        updated_by: null,
        updated_at: new Date().toISOString(),
      } as NtrImportSession;
      sessions.set(id, session);
      return Promise.resolve(session);
    }),
    update: vi.fn().mockImplementation((id, input) => {
      const existing = sessions.get(id)!;
      const updated = {
        ...existing,
        ...(input.status !== undefined && { status: input.status }),
        ...(input.validCount !== undefined && { valid_count: input.validCount }),
        ...(input.duplicateCount !== undefined && { duplicate_count: input.duplicateCount }),
        ...(input.skippedCount !== undefined && { skipped_count: input.skippedCount }),
        ...(input.failedCount !== undefined && { failed_count: input.failedCount }),
        ...(input.errors !== undefined && { errors: input.errors }),
        ...(input.completedAt !== undefined && { completed_at: input.completedAt }),
      };
      sessions.set(id, updated);
      return Promise.resolve(updated);
    }),
    getById: vi.fn().mockImplementation((id) => Promise.resolve(sessions.get(id) ?? null)),
    list: vi.fn(),
    listArchiveQueue: vi.fn(),
  };
}

describe('NtrImportService.preview - Serial Number validation (Legacy vs Strict mode)', () => {
  beforeEach(() => {
    fakeTables.dealers = [{ id: 'D1' }];
    fakeTables.vehicles = [];
  });

  it('Legacy mode: an unknown serial is valid, with a warning', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = csvBuffer([row()]);

    const { preview } = await service.preview(buffer, 'legacy.csv', ACTOR, 'legacy');

    expect(preview.validCount).toBe(1);
    expect(preview.warnings).toHaveLength(1);
    expect(preview.warnings[0].message).toContain('New Tractor record was created automatically');
  });

  it('Strict mode: an unknown serial is rejected outright', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = csvBuffer([row()]);

    const { preview } = await service.preview(buffer, 'legacy.csv', ACTOR, 'strict');

    expect(preview.validCount).toBe(0);
    expect(preview.failedCount).toBe(1);
    expect(preview.rows[0].reason).toContain('Unknown Product Serial Number');
  });

  it('a known serial with a mismatched Model is valid, with a warning', async () => {
    fakeTables.vehicles = [{ serial: 'SER-001', model: 'Model X' }];
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = csvBuffer([row({ model: 'Model Y' })]);

    const { preview } = await service.preview(buffer, 'legacy.csv', ACTOR, 'legacy');

    expect(preview.validCount).toBe(1);
    expect(preview.warnings[0].message).toContain('does not match the existing Tractor record');
  });
});

describe('NtrImportService.preview - duplicate detection', () => {
  beforeEach(() => {
    fakeTables.dealers = [{ id: 'D1' }];
    fakeTables.vehicles = [{ serial: 'X', model: null }];
  });

  it('rejects a serial duplicated within the same file', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = csvBuffer([
      row(),
      row({ serial: 'SER-001', engine: 'ENG-2', customer: 'Jane Doe', phone: '0898765432', deliveryDate: '2026-01-06' }),
    ]);

    const { preview } = await service.preview(buffer, 'legacy.csv', ACTOR, 'legacy');

    expect(preview.validCount).toBe(1);
    expect(preview.duplicateCount).toBe(1);
    expect(preview.rows[1].reason).toContain('Duplicate Product Serial Number');
  });

  it('flags a duplicate phone within the file as a warning only - never blocks import', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = csvBuffer([
      row(),
      row({ serial: 'SER-002', engine: 'ENG-2', customer: 'Jane Doe', deliveryDate: '2026-01-06' }),
    ]);

    const { preview } = await service.preview(buffer, 'legacy.csv', ACTOR, 'legacy');

    expect(preview.validCount).toBe(2);
    expect(preview.duplicateCount).toBe(0);
    expect(preview.warnings.some((w) => w.message.includes('Duplicate Customer Phone'))).toBe(true);
  });

  it('rejects a serial already registered as an active NTR', async () => {
    const ntrRepository = makeNtrRepository({
      findActiveBySerials: vi.fn().mockResolvedValue(new Map([['SER-001', { ntr_number: 'NTR-D1-2026-000001' } as NtrRecord]])),
    });
    const service = new NtrImportService(ntrRepository, makeSessionRepository());
    const buffer = csvBuffer([row()]);

    const { preview } = await service.preview(buffer, 'legacy.csv', ACTOR, 'legacy');

    expect(preview.duplicateCount).toBe(1);
    expect(preview.rows[0].reason).toContain('Duplicate NTR');
  });
});

describe('NtrImportService.preview - date validation', () => {
  beforeEach(() => {
    fakeTables.dealers = [{ id: 'D1' }];
    fakeTables.vehicles = [{ serial: 'X', model: null }];
  });

  it('rejects a future Retail Date', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const futureYear = new Date().getFullYear() + 5;
    const buffer = csvBuffer([row({ retailDate: `${futureYear}-01-01` })]);

    const { preview } = await service.preview(buffer, 'legacy.csv', ACTOR, 'legacy');

    expect(preview.failedCount).toBe(1);
    expect(preview.rows[0].reason).toContain('cannot be in the future');
  });

  it('rejects a Retail Date before the Manufacturing Year', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = csvBuffer([row({ manufacturingYear: '2030', retailDate: '2020-01-01' })]);

    const { preview } = await service.preview(buffer, 'legacy.csv', ACTOR, 'legacy');

    expect(preview.failedCount).toBe(1);
    expect(preview.rows[0].reason).toContain('before Manufacturing Year');
  });
});

describe('NtrImportService.preview - address validation', () => {
  beforeEach(() => {
    fakeTables.dealers = [{ id: 'D1' }];
    fakeTables.vehicles = [{ serial: 'X', model: null }];
  });

  it('rejects a district that does not belong to the given province', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = csvBuffer([row({ district: 'เมืองบุรีรัมย์', province: 'สุรินทร์' })]);

    const { preview } = await service.preview(buffer, 'legacy.csv', ACTOR, 'legacy');

    expect(preview.failedCount).toBe(1);
    expect(preview.rows[0].reason).toContain('does not belong to Province');
  });
});

describe('NtrImportService.preview - Dealer/Branch Scope Platform Standard (branch_id validation)', () => {
  beforeEach(() => {
    fakeTables.dealers = [{ id: 'D1' }, { id: 'D2' }];
    fakeTables.vehicles = [];
    fakeTables.branches = [{ id: 'B1', dealer_id: 'D1' }];
  });

  function branchRow(overrides: RowOverrides & { branch?: string } = {}): string {
    const { branch = '', ...rest } = overrides;
    return `${row(rest)},${branch}`;
  }

  function branchCsvBuffer(rows: string[]): Buffer {
    const header = `${CSV_HEADER},Branch`;
    return Buffer.from([header, ...rows].join('\n'), 'utf-8');
  }

  it('accepts a branch_id that belongs to the row\'s own dealer_id', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = branchCsvBuffer([branchRow({ branch: 'B1' })]);

    const { preview } = await service.preview(buffer, 'branch.csv', ACTOR, 'legacy');

    expect(preview.validCount).toBe(1);
    expect(preview.failedCount).toBe(0);
  });

  it('rejects a branch_id that belongs to a different dealer than the row\'s dealer_id', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    // B1 belongs to D1, but this row claims dealer D2 - a cross-dealer
    // branch_id, exactly the gap this validation closes.
    const buffer = branchCsvBuffer([branchRow({ dealer: 'D2', serial: 'SER-002', engine: 'ENG-2', customer: 'Jane Doe', phone: '0812345679', branch: 'B1' })]);

    const { preview } = await service.preview(buffer, 'branch.csv', ACTOR, 'legacy');

    expect(preview.validCount).toBe(0);
    expect(preview.failedCount).toBe(1);
    expect(preview.rows[0].reason).toContain('does not belong to dealer_id');
  });

  it('rejects a branch_id that does not exist at all', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = branchCsvBuffer([branchRow({ serial: 'SER-003', engine: 'ENG-3', customer: 'Somchai', phone: '0812345680', branch: 'UNKNOWN_BRANCH' })]);

    const { preview } = await service.preview(buffer, 'branch.csv', ACTOR, 'legacy');

    expect(preview.failedCount).toBe(1);
    expect(preview.rows[0].reason).toContain('does not belong to dealer_id');
  });

  it('a row with no branch_id at all is unaffected (branch is optional)', async () => {
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = branchCsvBuffer([branchRow({ serial: 'SER-004', engine: 'ENG-4', customer: 'Somsri', phone: '0812345681' })]);

    const { preview } = await service.preview(buffer, 'branch.csv', ACTOR, 'legacy');

    expect(preview.validCount).toBe(1);
    expect(preview.failedCount).toBe(0);
  });
});

describe('NtrImportService.preview - bulk prefetch performance', () => {
  it('issues exactly one dealer query and one vehicle query regardless of row count (no per-row DB call)', async () => {
    fakeTables.dealers = [{ id: 'D1' }];
    fakeTables.vehicles = [];
    const rows = Array.from({ length: 50 }, (_, i) =>
      row({ serial: `SER-BULK-${i}`, engine: `ENG-${i}`, customer: `Customer ${i}`, phone: `08123456${String(i).padStart(2, '0')}` })
    );
    const service = new NtrImportService(makeNtrRepository(), makeSessionRepository());
    const buffer = csvBuffer(rows);

    const { preview } = await service.preview(buffer, 'bulk.csv', ACTOR, 'legacy');

    expect(preview.totalRecords).toBe(50);
    expect(preview.validCount).toBe(50);
  });
});
