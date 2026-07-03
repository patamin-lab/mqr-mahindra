import { describe, it, expect, vi, beforeEach } from 'vitest';

// logAuditEvent/logAuditEvents touch Supabase (via @/lib/supabase, which
// throws when env vars aren't set) - stub only those two, keep every other
// @/lib/db export (diffFieldsForAudit in particular) real, so the audit
// event assertions below exercise the actual diff logic, not a mock.
vi.mock('@/lib/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db')>();
  return { ...actual, logAuditEvent: vi.fn(), logAuditEvents: vi.fn() };
});

import { MaintenanceService } from '../services/maintenanceService';
import type { MaintenanceRepository } from '../repositories/maintenanceRepository';
import type { MaintenanceRecord, MaintenanceRecordCreateInput, MaintenanceRecordUpdateInput } from '../types';

function makeRecord(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'rec-1',
    dealer_id: 'D1',
    branch_id: null,
    serial: null,
    model: null,
    delivery_date: null,
    engine_number: null,
    customer_name: null,
    customer_phone: null,
    technician_id: null,
    technician_name: null,
    branch_name: null,
    scheduled_date: null,
    performed_date: null,
    hour_meter: null,
    pm_interval_id: null,
    pm_number: null,
    next_pm_due: null,
    meter_photo_url: null,
    nameplate_photo_url: null,
    report_photo_url: null,
    meter_photo_attachment_id: null,
    nameplate_photo_attachment_id: null,
    report_photo_attachment_id: null,
    latitude: null,
    longitude: null,
    gps_accuracy: null,
    google_maps_url: null,
    status: 'Scheduled',
    notes: null,
    created_by: 'alice',
    // Recent by default (never past the 24h editable window) - tests that
    // specifically need an aged record override created_at explicitly.
    created_at: new Date().toISOString(),
    updated_by: 'alice',
    updated_at: new Date().toISOString(),
    locked_at: null,
    locked_reason: null,
    unlocked_until: null,
    unlocked_by: null,
    unlock_reason: null,
    deleted_reason: null,
    ...overrides,
  };
}

function makeMockRepository(): MaintenanceRepository {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findDuplicate: vi.fn(),
    listHistory: vi.fn(),
    lockRecord: vi.fn(),
    unlockRecord: vi.fn(),
    lockSupersededRecordsForVehicle: vi.fn(),
  };
}

describe('MaintenanceService', () => {
  let repository: MaintenanceRepository;
  let service: MaintenanceService;
  const actor = { username: 'alice' };

  beforeEach(() => {
    repository = makeMockRepository();
    service = new MaintenanceService(repository);
  });

  describe('list', () => {
    it('delegates to repository.list with the given filter and returns its result', async () => {
      const records = [makeRecord()];
      (repository.list as ReturnType<typeof vi.fn>).mockResolvedValue(records);

      const filter = { dealerId: 'D1' };
      const result = await service.list(filter);

      expect(repository.list).toHaveBeenCalledWith(filter);
      expect(result).toBe(records);
    });

    it('passes through an undefined filter unchanged', async () => {
      (repository.list as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await service.list();

      expect(repository.list).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getById', () => {
    it('delegates to repository.getById and returns its result', async () => {
      const record = makeRecord();
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(record);

      const result = await service.getById('rec-1');

      expect(repository.getById).toHaveBeenCalledWith('rec-1');
      expect(result).toBe(record);
    });

    it('returns null when the repository reports no active record', async () => {
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getById('missing');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    const input: MaintenanceRecordCreateInput = {
      dealer_id: 'D1',
      branch_id: null,
      serial: 'SN-1',
      model: null,
      delivery_date: null,
      engine_number: null,
      customer_name: 'Somchai',
      customer_phone: '081-2345678',
      technician_id: 'tech-1',
      performed_date: '2026-01-01',
      hour_meter: 100,
      pm_interval_id: 'interval-1',
      meter_photo_url: 'https://drive.google.com/meter.jpg',
      nameplate_photo_url: 'https://drive.google.com/nameplate.jpg',
      report_photo_url: 'https://drive.google.com/report.jpg',
      notes: null,
    };

    it('delegates to repository.create with the given input and actor', async () => {
      const created = makeRecord();
      (repository.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

      const result = await service.create(input, actor);

      expect(repository.create).toHaveBeenCalledWith(input, actor);
      expect(result).toBe(created);
    });

    it('rejects an actor with an empty/whitespace username without calling the repository', async () => {
      await expect(service.create(input, { username: '   ' })).rejects.toThrow(
        'Actor username is required'
      );
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    const input: MaintenanceRecordUpdateInput = { status: 'Completed' };

    it('delegates to repository.update with the given id, input, and actor', async () => {
      const existing = makeRecord();
      const updated = makeRecord({ status: 'Completed' });
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (repository.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.update('rec-1', input, actor);

      expect(repository.update).toHaveBeenCalledWith('rec-1', input, actor);
      expect(result).toBe(updated);
    });

    it('rejects an actor with no username without calling the repository', async () => {
      await expect(service.update('rec-1', input, { username: '' })).rejects.toThrow(
        'Actor username is required'
      );
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('throws when the record does not exist', async () => {
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(service.update('missing', input, actor)).rejects.toThrow('Maintenance record not found');
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('blocks a calculation-affecting edit on a locked record', async () => {
      const existing = makeRecord({ locked_at: '2026-01-02T00:00:00.000Z', locked_reason: 'superseded' });
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      await expect(service.update('rec-1', { hour_meter: 999 }, actor)).rejects.toThrow(/ถูกล็อก/);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('allows a non-calculation edit (notes) on a locked record', async () => {
      const existing = makeRecord({ locked_at: '2026-01-02T00:00:00.000Z', locked_reason: 'superseded' });
      const updated = makeRecord({ ...existing, notes: 'ok' });
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (repository.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.update('rec-1', { notes: 'ok' }, actor);

      expect(repository.update).toHaveBeenCalledWith('rec-1', { notes: 'ok' }, actor);
      expect(result).toBe(updated);
    });

    it('allows a calculation-affecting edit once the temporary unlock window is still active', async () => {
      const futureIso = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const existing = makeRecord({
        created_at: '2020-01-01T00:00:00.000Z', // long past the 24h window
        unlocked_until: futureIso,
      });
      const updated = makeRecord({ hour_meter: 999 });
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(existing);
      (repository.update as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.update('rec-1', { hour_meter: 999 }, actor);

      expect(repository.update).toHaveBeenCalledWith('rec-1', { hour_meter: 999 }, actor);
      expect(result).toBe(updated);
    });
  });

  describe('delete', () => {
    it('delegates to repository.delete with the given id and actor when unlocked', async () => {
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(makeRecord());
      (repository.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await service.delete('rec-1', actor);

      expect(repository.delete).toHaveBeenCalledWith('rec-1', actor, undefined);
    });

    it('rejects an actor with no username without calling the repository', async () => {
      await expect(service.delete('rec-1', { username: '' })).rejects.toThrow(
        'Actor username is required'
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('blocks deleting a locked record for a non-SuperAdmin actor', async () => {
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeRecord({ locked_at: '2026-01-02T00:00:00.000Z', locked_reason: 'superseded' })
      );

      await expect(service.delete('rec-1', { username: 'alice', role: 'CentralAdmin' })).rejects.toThrow(
        /Super Admin/
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('blocks deleting a locked record for SuperAdmin without a reason', async () => {
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeRecord({ locked_at: '2026-01-02T00:00:00.000Z', locked_reason: 'superseded' })
      );

      await expect(service.delete('rec-1', { username: 'alice', role: 'SuperAdmin' })).rejects.toThrow(
        /เหตุผล/
      );
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('allows SuperAdmin to delete a locked record when a reason is given', async () => {
      (repository.getById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makeRecord({ locked_at: '2026-01-02T00:00:00.000Z', locked_reason: 'superseded' })
      );
      (repository.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await service.delete('rec-1', { username: 'alice', role: 'SuperAdmin' }, 'duplicate entry, confirmed with dealer');

      expect(repository.delete).toHaveBeenCalledWith(
        'rec-1',
        { username: 'alice', role: 'SuperAdmin' },
        'duplicate entry, confirmed with dealer'
      );
    });
  });

  describe('create (supersession lock)', () => {
    const input: MaintenanceRecordCreateInput = {
      dealer_id: 'D1',
      branch_id: null,
      serial: 'SN-1',
      model: null,
      delivery_date: null,
      engine_number: null,
      customer_name: 'Somchai',
      customer_phone: '081-2345678',
      technician_id: 'tech-1',
      performed_date: '2026-06-01',
      hour_meter: 200,
      pm_interval_id: 'interval-2',
      meter_photo_url: 'https://drive.google.com/meter.jpg',
      nameplate_photo_url: 'https://drive.google.com/nameplate.jpg',
      report_photo_url: 'https://drive.google.com/report.jpg',
      notes: null,
    };

    it('locks superseded records for the same vehicle after a successful create', async () => {
      const created = makeRecord({ serial: 'SN-1' });
      (repository.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);
      (repository.lockSupersededRecordsForVehicle as ReturnType<typeof vi.fn>).mockResolvedValue(['rec-old-1']);

      await service.create(input, actor);

      expect(repository.lockSupersededRecordsForVehicle).toHaveBeenCalledWith('SN-1', actor);
    });

    it('does not attempt supersession locking when the created record has no serial', async () => {
      const created = makeRecord({ serial: null });
      (repository.create as ReturnType<typeof vi.fn>).mockResolvedValue(created);

      await service.create(input, actor);

      expect(repository.lockSupersededRecordsForVehicle).not.toHaveBeenCalled();
    });
  });

  describe('findDuplicate', () => {
    it('delegates to repository.findDuplicate and returns its result', async () => {
      const existing = makeRecord();
      (repository.findDuplicate as ReturnType<typeof vi.fn>).mockResolvedValue(existing);

      const params = { serial: 'SN-1', pmIntervalId: 'interval-1', performedDate: '2026-01-01' };
      const result = await service.findDuplicate(params);

      expect(repository.findDuplicate).toHaveBeenCalledWith(params);
      expect(result).toBe(existing);
    });

    it('returns null when no duplicate exists', async () => {
      (repository.findDuplicate as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.findDuplicate({ serial: 'SN-1', pmIntervalId: 'interval-1', performedDate: '2026-01-01' });

      expect(result).toBeNull();
    });
  });

  describe('listHistory', () => {
    it('delegates to repository.listHistory with the given filter and returns its result', async () => {
      const result = { data: [makeRecord()], total: 1 };
      (repository.listHistory as ReturnType<typeof vi.fn>).mockResolvedValue(result);

      const filter = { page: 1, pageSize: 25, search: 'SN-1' };
      const returned = await service.listHistory(filter);

      expect(repository.listHistory).toHaveBeenCalledWith(filter);
      expect(returned).toBe(result);
    });
  });
});
