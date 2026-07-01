import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PmRecordService } from './service';
import type { PmRecordRepository } from './repository';
import type { PmRecord, PmRecordCreateInput, PmRecordUpdateInput } from './types';

function makeRecord(overrides: Partial<PmRecord> = {}): PmRecord {
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
    latitude: null,
    longitude: null,
    gps_accuracy: null,
    google_maps_url: null,
    status: 'Scheduled',
    notes: null,
    created_by: 'alice',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_by: 'alice',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockRepository(): PmRecordRepository {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findDuplicate: vi.fn(),
    listHistory: vi.fn(),
  };
}

describe('PmRecordService', () => {
  let repository: PmRecordRepository;
  let service: PmRecordService;
  const actor = { username: 'alice' };

  beforeEach(() => {
    repository = makeMockRepository();
    service = new PmRecordService(repository);
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
    const input: PmRecordCreateInput = {
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
    const input: PmRecordUpdateInput = { status: 'Completed' };

    it('delegates to repository.update with the given id, input, and actor', async () => {
      const updated = makeRecord({ status: 'Completed' });
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
  });

  describe('delete', () => {
    it('delegates to repository.delete with the given id and actor', async () => {
      (repository.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await service.delete('rec-1', actor);

      expect(repository.delete).toHaveBeenCalledWith('rec-1', actor);
    });

    it('rejects an actor with no username without calling the repository', async () => {
      await expect(service.delete('rec-1', { username: '' })).rejects.toThrow(
        'Actor username is required'
      );
      expect(repository.delete).not.toHaveBeenCalled();
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
