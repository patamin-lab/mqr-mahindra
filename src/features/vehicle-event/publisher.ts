/**
 * VehicleEventPublisher — the ONLY entry point into the Vehicle Event
 * Platform Service for business modules.
 *
 * Converts business data (a serial number, an event code, module-specific
 * details) into a Platform Event: resolves `serial` -> `vehicle_id` and
 * `eventCode` -> `event_definition_id`, then hands a fully-formed
 * `VehicleEventCreateInput` to `VehicleEventService`. No business module
 * constructs that payload manually, and none of the `publish*` methods
 * below duplicate the calling module's own business record - only a
 * `source_module` + `reference_id` pointer back to it.
 *
 * Deliberately not wired into any real module yet (Phase 4.5 is
 * infrastructure only) - see PROJECT_STATE.md for why.
 */
import { VehicleEventService } from './service';
import { EventCode, VehicleEvent, VehicleEventActor } from './types';

export interface VehicleLookup {
  /** Resolves a vehicle serial to its internal `vehicles.id`. Returns null
   *  if no such vehicle exists - callers must decide whether that's fatal. */
  getVehicleIdBySerial(serial: string): Promise<string | null>;
}

export interface PublishEventInput {
  eventCode: EventCode;
  serial: string;
  sourceModule: string;
  referenceId: string;
  /** Defaults to now() when omitted. */
  eventDatetime?: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  status?: string | null;
  actor: VehicleEventActor;
}

interface BaseModuleInput {
  serial: string;
  referenceId: string;
  eventDatetime: string;
  actor: VehicleEventActor;
}

export interface PublishMaintenanceCompletedInput extends BaseModuleInput {
  hourMeter?: number | null;
  intervalLabel?: string | null;
  technician?: string | null;
  dealer?: string | null;
}

export interface PublishNtrCreatedInput extends BaseModuleInput {
  customerName?: string | null;
}

export interface PublishNtrCompletedInput extends BaseModuleInput {
  customerName?: string | null;
}

export interface PublishPdiCompletedInput extends BaseModuleInput {
  inspector?: string | null;
  result?: string | null;
}

export interface PublishMqrOpenedInput extends BaseModuleInput {
  problemSystem?: string | null;
  problemCode?: string | null;
  severity?: string | null;
  reporter?: string | null;
}

export interface PublishMqrClosedInput extends BaseModuleInput {
  correctiveAction?: string | null;
  technician?: string | null;
}

export interface PublishCampaignAssignedInput extends BaseModuleInput {
  campaignName?: string | null;
}

export interface PublishCampaignCompletedInput extends BaseModuleInput {
  campaignName?: string | null;
}

export interface PublishPartsRequestedInput extends BaseModuleInput {
  partName?: string | null;
  quantity?: number | null;
}

export interface PublishPartsDeliveredInput extends BaseModuleInput {
  partName?: string | null;
  quantity?: number | null;
}

export class VehicleEventPublisher {
  constructor(
    private readonly service: VehicleEventService,
    private readonly vehicleLookup: VehicleLookup
  ) {}

  /** Generic escape hatch - every `publish*` convenience method below is
   *  implemented in terms of this one. */
  async publish(input: PublishEventInput): Promise<VehicleEvent> {
    const [vehicleId, definition] = await Promise.all([
      this.vehicleLookup.getVehicleIdBySerial(input.serial),
      this.service.getEventDefinitionByCode(input.eventCode),
    ]);
    if (!vehicleId) {
      throw new Error(`Cannot publish event: no vehicle found for serial "${input.serial}"`);
    }
    if (!definition) {
      throw new Error(`Cannot publish event: unknown event code "${input.eventCode}"`);
    }

    return this.service.createEvent(
      {
        vehicle_id: vehicleId,
        event_definition_id: definition.id,
        source_module: input.sourceModule,
        reference_id: input.referenceId,
        event_datetime: input.eventDatetime ?? new Date().toISOString(),
        title: input.title,
        description: input.description ?? null,
        // `event_code` is echoed into metadata (in addition to the real FK,
        // event_definition_id) so a generic timeline adapter (see
        // features/vehicle/eventSources/ntrEvents.ts) can distinguish event
        // types without a second lookup query - safe to add now since no
        // module was reading vehicle_events' metadata shape before NTR
        // became the first real consumer of this platform service.
        metadata: { ...(input.metadata ?? {}), event_code: input.eventCode },
        status: input.status ?? null,
      },
      input.actor
    );
  }

  async publishNtrCreated(input: PublishNtrCreatedInput): Promise<VehicleEvent> {
    return this.publish({
      eventCode: 'NTR_CREATED',
      serial: input.serial,
      sourceModule: 'ntr',
      referenceId: input.referenceId,
      eventDatetime: input.eventDatetime,
      title: 'เริ่มจดทะเบียนรถใหม่ (NTR)',
      metadata: { customer_name: input.customerName ?? null },
      actor: input.actor,
    });
  }

  async publishMaintenanceCompleted(input: PublishMaintenanceCompletedInput): Promise<VehicleEvent> {
    return this.publish({
      eventCode: 'MAINTENANCE_COMPLETED',
      serial: input.serial,
      sourceModule: 'maintenance',
      referenceId: input.referenceId,
      eventDatetime: input.eventDatetime,
      title: input.intervalLabel ? `บำรุงรักษาเชิงป้องกัน (${input.intervalLabel})` : 'บำรุงรักษาเชิงป้องกัน',
      metadata: {
        hour_meter: input.hourMeter ?? null,
        interval: input.intervalLabel ?? null,
        technician: input.technician ?? null,
        dealer: input.dealer ?? null,
      },
      actor: input.actor,
    });
  }

  async publishNtrCompleted(input: PublishNtrCompletedInput): Promise<VehicleEvent> {
    return this.publish({
      eventCode: 'NTR_COMPLETED',
      serial: input.serial,
      sourceModule: 'ntr',
      referenceId: input.referenceId,
      eventDatetime: input.eventDatetime,
      title: 'จดทะเบียนรถใหม่ (NTR)',
      metadata: { customer_name: input.customerName ?? null },
      actor: input.actor,
    });
  }

  async publishPdiCompleted(input: PublishPdiCompletedInput): Promise<VehicleEvent> {
    return this.publish({
      eventCode: 'PDI_COMPLETED',
      serial: input.serial,
      sourceModule: 'pdi',
      referenceId: input.referenceId,
      eventDatetime: input.eventDatetime,
      title: 'ตรวจสภาพก่อนส่งมอบ (PDI)',
      metadata: { inspector: input.inspector ?? null, result: input.result ?? null },
      actor: input.actor,
    });
  }

  async publishMqrOpened(input: PublishMqrOpenedInput): Promise<VehicleEvent> {
    return this.publish({
      eventCode: 'MQR_OPENED',
      serial: input.serial,
      sourceModule: 'mqr',
      referenceId: input.referenceId,
      eventDatetime: input.eventDatetime,
      title: 'เปิดรายงานปัญหาคุณภาพ (MQR)',
      status: input.severity ?? null,
      metadata: {
        problem_system: input.problemSystem ?? null,
        problem_code: input.problemCode ?? null,
        severity: input.severity ?? null,
        reporter: input.reporter ?? null,
      },
      actor: input.actor,
    });
  }

  async publishMqrClosed(input: PublishMqrClosedInput): Promise<VehicleEvent> {
    return this.publish({
      eventCode: 'MQR_CLOSED',
      serial: input.serial,
      sourceModule: 'mqr',
      referenceId: input.referenceId,
      eventDatetime: input.eventDatetime,
      title: 'ปิดรายงานปัญหาคุณภาพ (MQR)',
      metadata: { corrective_action: input.correctiveAction ?? null, technician: input.technician ?? null },
      actor: input.actor,
    });
  }

  async publishCampaignAssigned(input: PublishCampaignAssignedInput): Promise<VehicleEvent> {
    return this.publish({
      eventCode: 'CAMPAIGN_ASSIGNED',
      serial: input.serial,
      sourceModule: 'campaign',
      referenceId: input.referenceId,
      eventDatetime: input.eventDatetime,
      title: input.campaignName ? `มอบหมายแคมเปญ (${input.campaignName})` : 'มอบหมายแคมเปญ',
      metadata: { campaign_name: input.campaignName ?? null },
      actor: input.actor,
    });
  }

  async publishCampaignCompleted(input: PublishCampaignCompletedInput): Promise<VehicleEvent> {
    return this.publish({
      eventCode: 'CAMPAIGN_COMPLETED',
      serial: input.serial,
      sourceModule: 'campaign',
      referenceId: input.referenceId,
      eventDatetime: input.eventDatetime,
      title: input.campaignName ? `ดำเนินการแคมเปญเสร็จสิ้น (${input.campaignName})` : 'ดำเนินการแคมเปญเสร็จสิ้น',
      metadata: { campaign_name: input.campaignName ?? null },
      actor: input.actor,
    });
  }

  async publishPartsRequested(input: PublishPartsRequestedInput): Promise<VehicleEvent> {
    return this.publish({
      eventCode: 'PART_REQUESTED',
      serial: input.serial,
      sourceModule: 'parts_request',
      referenceId: input.referenceId,
      eventDatetime: input.eventDatetime,
      title: 'ขออะไหล่',
      metadata: { part_name: input.partName ?? null, quantity: input.quantity ?? null },
      actor: input.actor,
    });
  }

  async publishPartsDelivered(input: PublishPartsDeliveredInput): Promise<VehicleEvent> {
    return this.publish({
      eventCode: 'PART_DELIVERED',
      serial: input.serial,
      sourceModule: 'parts_request',
      referenceId: input.referenceId,
      eventDatetime: input.eventDatetime,
      title: 'จัดส่งอะไหล่แล้ว',
      metadata: { part_name: input.partName ?? null, quantity: input.quantity ?? null },
      actor: input.actor,
    });
  }
}
