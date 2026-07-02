import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehicleEventService } from './service';
import type { VehicleEventRepository } from './repository';
import type { EventDefinition, VehicleEvent, VehicleEventCreateInput } from './types';

function makeEvent(overrides: Partial<VehicleEvent> = {}): VehicleEvent {
  return {
    id: 'evt-1',
    vehicle_id: 'veh-1',
    event_definition_id: 'def-1',
    source_module: 'maintenance',
    reference_id: 'PM-D1-2026-000001',
    event_datetime: '2026-01-01T00:00:00.000Z',
    title: 'บำรุงรักษาเชิงป้องกัน',
    description: null,
    metadata: {},
    status: null,
    created_by: 'alice',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_by: 'alice',
    updated_at: '2026-01-01T00:00:00.000Z',
    record_status: 'Active',
    ...overrides,
  };
}

function makeDefinition(overrides: Partial<EventDefinition> = {}): EventDefinition {
  return {
    id: 'def-1',
    event_code: 'MAINTENANCE_COMPLETED',
    display_name_en: 'Maintenance Completed',
    display_name_th: 'บำรุงรักษาเชิงป้องกัน',
    module: 'maintenance',
    icon: null,
    color: null,
    display_order: 50,
    active: true,
    ...overrides,
  };
}

function makeMockRepository(): VehicleEventRepository {
  return {
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    getVehicleEvents: vi.fn(),
    getModuleEvents: vi.fn(),
    searchEvents: vi.fn(),
    getEventDefinitionByCode: vi.fn(),
  };
}

describe('VehicleEventService', () => {
  let repository: VehicleEventRepository;
  let service: VehicleEventService;
  const actor = { username: 'alice' };

  beforeEach(() => {
    repository = makeMockRepository();
    service = new VehicleEventService(repository);
  });

  describe('createEvent', () => {
    const input: VehicleEventCreateInput = {
      vehicle_id: 'veh-1',
      event_definition_id: 'def-1',
      source_module: 'maintenance',
      reference_id: 'PM-D1-2026-000001',
      event_datetime: '2026-01-01T00:00:00.000Z',
      title: 'บำรุงรักษาเชิงป้องกัน',
    };

    it('delegates to repository.createEvent with the given input and actor', async () => {
      const created = makeEvent();
      (repository.createEvent as ReturnType<typeof vi.fn>).mockResolvedValue(created);

      const result = await service.createEvent(input, actor);

      expect(repository.createEvent).toHaveBeenCalledWith(input, actor);
      expect(result).toBe(created);
    });

    it('rejects an actor with an empty/whitespace username without calling the repository', async () => {
      await expect(service.createEvent(input, { username: '   ' })).rejects.toThrow('Actor username is required');
      expect(repository.createEvent).not.toHaveBeenCalled();
    });

    it.each([
      ['vehicle_id', { ...input, vehicle_id: '' }],
      ['event_definition_id', { ...input, event_definition_id: '' }],
      ['source_module', { ...input, source_module: '' }],
      ['reference_id', { ...input, reference_id: '' }],
      ['event_datetime', { ...input, event_datetime: '' }],
      ['title', { ...input, title: '' }],
    ])('rejects a missing %s without calling the repository', async (field, badInput) => {
      await expect(service.createEvent(badInput, actor)).rejects.toThrow(`${field} is required`);
      expect(repository.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('updateEvent', () => {
    it('delegates to repository.updateEvent with the given id, input, and actor', async () => {
      const updated = makeEvent({ title: 'Updated' });
      (repository.updateEvent as ReturnType<typeof vi.fn>).mockResolvedValue(updated);

      const result = await service.updateEvent('evt-1', { title: 'Updated' }, actor);

      expect(repository.updateEvent).toHaveBeenCalledWith('evt-1', { title: 'Updated' }, actor);
      expect(result).toBe(updated);
    });

    it('rejects an actor with no username without calling the repository', async () => {
      await expect(service.updateEvent('evt-1', { title: 'x' }, { username: '' })).rejects.toThrow(
        'Actor username is required'
      );
      expect(repository.updateEvent).not.toHaveBeenCalled();
    });
  });

  describe('deleteEvent', () => {
    it('delegates to repository.deleteEvent with the given id and actor', async () => {
      (repository.deleteEvent as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

      await service.deleteEvent('evt-1', actor);

      expect(repository.deleteEvent).toHaveBeenCalledWith('evt-1', actor);
    });

    it('rejects an actor with no username without calling the repository', async () => {
      await expect(service.deleteEvent('evt-1', { username: '' })).rejects.toThrow('Actor username is required');
      expect(repository.deleteEvent).not.toHaveBeenCalled();
    });
  });

  describe('getVehicleEvents', () => {
    it('delegates to repository.getVehicleEvents and returns its result', async () => {
      const events = [makeEvent()];
      (repository.getVehicleEvents as ReturnType<typeof vi.fn>).mockResolvedValue(events);

      const result = await service.getVehicleEvents('veh-1');

      expect(repository.getVehicleEvents).toHaveBeenCalledWith('veh-1');
      expect(result).toBe(events);
    });
  });

  describe('getModuleEvents', () => {
    it('delegates to repository.getModuleEvents and returns its result', async () => {
      const events = [makeEvent()];
      (repository.getModuleEvents as ReturnType<typeof vi.fn>).mockResolvedValue(events);

      const result = await service.getModuleEvents('maintenance');

      expect(repository.getModuleEvents).toHaveBeenCalledWith('maintenance');
      expect(result).toBe(events);
    });
  });

  describe('searchEvents', () => {
    it('delegates to repository.searchEvents with the given filter and returns its result', async () => {
      const result = { data: [makeEvent()], total: 1 };
      (repository.searchEvents as ReturnType<typeof vi.fn>).mockResolvedValue(result);

      const filter = { page: 1, pageSize: 25 };
      const returned = await service.searchEvents(filter);

      expect(repository.searchEvents).toHaveBeenCalledWith(filter);
      expect(returned).toBe(result);
    });
  });

  describe('getEventDefinitionByCode', () => {
    it('delegates to repository.getEventDefinitionByCode and returns its result', async () => {
      const definition = makeDefinition();
      (repository.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(definition);

      const result = await service.getEventDefinitionByCode('MAINTENANCE_COMPLETED');

      expect(repository.getEventDefinitionByCode).toHaveBeenCalledWith('MAINTENANCE_COMPLETED');
      expect(result).toBe(definition);
    });

    it('returns null when the event code is unknown', async () => {
      (repository.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const result = await service.getEventDefinitionByCode('NOT_A_CODE');

      expect(result).toBeNull();
    });
  });
});
