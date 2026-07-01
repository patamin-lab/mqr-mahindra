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
    technician_id: null,
    scheduled_date: null,
    performed_date: null,
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
      serial: null,
      technician_id: null,
      scheduled_date: null,
      status: 'Scheduled',
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
});
