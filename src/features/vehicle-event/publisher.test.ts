import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehicleEventPublisher, VehicleLookup } from './publisher';
import type { VehicleEventService } from './service';
import type { EventDefinition, VehicleEvent } from './types';

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

function makeDefinition(eventCode = 'MAINTENANCE_COMPLETED'): EventDefinition {
  return {
    id: 'def-1',
    event_code: eventCode as EventDefinition['event_code'],
    display_name_en: eventCode,
    display_name_th: eventCode,
    module: 'maintenance',
    icon: null,
    color: null,
    display_order: 0,
    active: true,
  };
}

function makeMockService(): VehicleEventService {
  return {
    createEvent: vi.fn(),
    getEventDefinitionByCode: vi.fn(),
  } as unknown as VehicleEventService;
}

function makeMockVehicleLookup(vehicleId: string | null = 'veh-1'): VehicleLookup {
  return { getVehicleIdBySerial: vi.fn().mockResolvedValue(vehicleId) };
}

const actor = { username: 'alice' };

describe('VehicleEventPublisher', () => {
  let service: VehicleEventService;
  let vehicleLookup: VehicleLookup;
  let publisher: VehicleEventPublisher;

  beforeEach(() => {
    service = makeMockService();
    vehicleLookup = makeMockVehicleLookup();
    publisher = new VehicleEventPublisher(service, vehicleLookup);
  });

  describe('publish', () => {
    it('resolves serial -> vehicle_id and eventCode -> event_definition_id, then creates the event', async () => {
      (service.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(makeDefinition());
      (service.createEvent as ReturnType<typeof vi.fn>).mockResolvedValue(makeEvent());

      await publisher.publish({
        eventCode: 'MAINTENANCE_COMPLETED',
        serial: 'SN-1',
        sourceModule: 'maintenance',
        referenceId: 'PM-D1-2026-000001',
        eventDatetime: '2026-01-01T00:00:00.000Z',
        title: 'บำรุงรักษาเชิงป้องกัน',
        actor,
      });

      expect(vehicleLookup.getVehicleIdBySerial).toHaveBeenCalledWith('SN-1');
      expect(service.getEventDefinitionByCode).toHaveBeenCalledWith('MAINTENANCE_COMPLETED');
      expect(service.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          vehicle_id: 'veh-1',
          event_definition_id: 'def-1',
          source_module: 'maintenance',
          reference_id: 'PM-D1-2026-000001',
        }),
        actor
      );
    });

    it('defaults event_datetime to now() when omitted', async () => {
      (service.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(makeDefinition());
      (service.createEvent as ReturnType<typeof vi.fn>).mockResolvedValue(makeEvent());

      await publisher.publish({
        eventCode: 'MAINTENANCE_COMPLETED',
        serial: 'SN-1',
        sourceModule: 'maintenance',
        referenceId: 'PM-D1-2026-000001',
        title: 'บำรุงรักษาเชิงป้องกัน',
        actor,
      });

      const call = (service.createEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(typeof call.event_datetime).toBe('string');
      expect(Number.isNaN(Date.parse(call.event_datetime))).toBe(false);
    });

    it('never duplicates business data - only stores source_module + reference_id + metadata, not a copy of the record', async () => {
      (service.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(makeDefinition());
      (service.createEvent as ReturnType<typeof vi.fn>).mockResolvedValue(makeEvent());

      await publisher.publish({
        eventCode: 'MAINTENANCE_COMPLETED',
        serial: 'SN-1',
        sourceModule: 'maintenance',
        referenceId: 'PM-D1-2026-000001',
        title: 'บำรุงรักษาเชิงป้องกัน',
        metadata: { hour_meter: 520 },
        actor,
      });

      const call = (service.createEvent as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(Object.keys(call).sort()).toEqual(
        [
          'vehicle_id',
          'event_definition_id',
          'source_module',
          'reference_id',
          'event_datetime',
          'title',
          'description',
          'metadata',
          'status',
        ].sort()
      );
    });

    it('throws when no vehicle exists for the given serial, without calling createEvent', async () => {
      vehicleLookup = makeMockVehicleLookup(null);
      publisher = new VehicleEventPublisher(service, vehicleLookup);
      (service.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(makeDefinition());

      await expect(
        publisher.publish({
          eventCode: 'MAINTENANCE_COMPLETED',
          serial: 'UNKNOWN',
          sourceModule: 'maintenance',
          referenceId: 'PM-1',
          title: 'x',
          actor,
        })
      ).rejects.toThrow('no vehicle found for serial "UNKNOWN"');
      expect(service.createEvent).not.toHaveBeenCalled();
    });

    it('throws when the event code is unknown, without calling createEvent', async () => {
      (service.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      await expect(
        publisher.publish({
          eventCode: 'OTHER',
          serial: 'SN-1',
          sourceModule: 'other',
          referenceId: 'REF-1',
          title: 'x',
          actor,
        })
      ).rejects.toThrow('unknown event code "OTHER"');
      expect(service.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('publishMaintenanceCompleted', () => {
    it('publishes MAINTENANCE_COMPLETED under source_module=maintenance with hour_meter/interval/technician/dealer metadata', async () => {
      (service.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(makeDefinition('MAINTENANCE_COMPLETED'));
      (service.createEvent as ReturnType<typeof vi.fn>).mockResolvedValue(makeEvent());

      await publisher.publishMaintenanceCompleted({
        serial: 'SN-1',
        referenceId: 'PM-D1-2026-000001',
        eventDatetime: '2026-01-01T00:00:00.000Z',
        hourMeter: 520,
        intervalLabel: '500 Hr',
        technician: 'John',
        dealer: 'KTV',
        actor,
      });

      expect(service.getEventDefinitionByCode).toHaveBeenCalledWith('MAINTENANCE_COMPLETED');
      expect(service.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          source_module: 'maintenance',
          reference_id: 'PM-D1-2026-000001',
          metadata: { hour_meter: 520, interval: '500 Hr', technician: 'John', dealer: 'KTV' },
        }),
        actor
      );
    });
  });

  describe('publishMqrOpened', () => {
    it('publishes MQR_OPENED under source_module=mqr with severity/problem metadata', async () => {
      (service.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(makeDefinition('MQR_OPENED'));
      (service.createEvent as ReturnType<typeof vi.fn>).mockResolvedValue(makeEvent());

      await publisher.publishMqrOpened({
        serial: 'SN-1',
        referenceId: 'QIR-2601-0001',
        eventDatetime: '2026-01-01T00:00:00.000Z',
        problemSystem: 'Powertrain',
        problemCode: 'ENGINE_NOISE',
        severity: 'Major',
        reporter: 'Somchai',
        actor,
      });

      expect(service.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          source_module: 'mqr',
          reference_id: 'QIR-2601-0001',
          status: 'Major',
          metadata: {
            problem_system: 'Powertrain',
            problem_code: 'ENGINE_NOISE',
            severity: 'Major',
            reporter: 'Somchai',
          },
        }),
        actor
      );
    });
  });

  describe('publishMqrClosed', () => {
    it('publishes MQR_CLOSED under source_module=mqr', async () => {
      (service.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(makeDefinition('MQR_CLOSED'));
      (service.createEvent as ReturnType<typeof vi.fn>).mockResolvedValue(makeEvent());

      await publisher.publishMqrClosed({
        serial: 'SN-1',
        referenceId: 'QIR-2601-0001',
        eventDatetime: '2026-01-05T00:00:00.000Z',
        correctiveAction: 'Replaced injector',
        technician: 'John',
        actor,
      });

      expect(service.createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          source_module: 'mqr',
          reference_id: 'QIR-2601-0001',
          metadata: { corrective_action: 'Replaced injector', technician: 'John' },
        }),
        actor
      );
    });
  });

  describe.each([
    ['publishNtrCompleted', 'ntr', 'NTR_COMPLETED'],
    ['publishPdiCompleted', 'pdi', 'PDI_COMPLETED'],
    ['publishCampaignAssigned', 'campaign', 'CAMPAIGN_ASSIGNED'],
    ['publishCampaignCompleted', 'campaign', 'CAMPAIGN_COMPLETED'],
    ['publishPartsRequested', 'parts_request', 'PART_REQUESTED'],
    ['publishPartsDelivered', 'parts_request', 'PART_DELIVERED'],
  ] as const)('%s', (method, sourceModule, eventCode) => {
    it(`publishes ${eventCode} under source_module=${sourceModule}`, async () => {
      (service.getEventDefinitionByCode as ReturnType<typeof vi.fn>).mockResolvedValue(makeDefinition(eventCode));
      (service.createEvent as ReturnType<typeof vi.fn>).mockResolvedValue(makeEvent());

      await (publisher[method] as (input: unknown) => Promise<VehicleEvent>)({
        serial: 'SN-1',
        referenceId: 'REF-1',
        eventDatetime: '2026-01-01T00:00:00.000Z',
        actor,
      });

      expect(service.getEventDefinitionByCode).toHaveBeenCalledWith(eventCode);
      expect(service.createEvent).toHaveBeenCalledWith(expect.objectContaining({ source_module: sourceModule }), actor);
    });
  });
});
