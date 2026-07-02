/**
 * Vehicle Event — service layer.
 *
 * Validates before delegating to the repository - mirrors
 * `src/features/pm-record/service.ts`'s shape exactly. Every business
 * module (Maintenance, MQR, future PDI/NTR/...) reaches this layer only
 * through `VehicleEventPublisher`, never directly.
 */
import { VehicleEventRepository } from './repository';
import {
  EventDefinition,
  VehicleEvent,
  VehicleEventActor,
  VehicleEventCreateInput,
  VehicleEventFilter,
  VehicleEventListResult,
  VehicleEventUpdateInput,
} from './types';

function requireActor(actor: VehicleEventActor): void {
  if (!actor?.username?.trim()) {
    throw new Error('Actor username is required');
  }
}

function requireNonEmpty(value: string | undefined, field: string): void {
  if (!value?.trim()) {
    throw new Error(`${field} is required`);
  }
}

export class VehicleEventService {
  constructor(private readonly repository: VehicleEventRepository) {}

  async createEvent(input: VehicleEventCreateInput, actor: VehicleEventActor): Promise<VehicleEvent> {
    requireActor(actor);
    requireNonEmpty(input.vehicle_id, 'vehicle_id');
    requireNonEmpty(input.event_definition_id, 'event_definition_id');
    requireNonEmpty(input.source_module, 'source_module');
    requireNonEmpty(input.reference_id, 'reference_id');
    requireNonEmpty(input.event_datetime, 'event_datetime');
    requireNonEmpty(input.title, 'title');
    return this.repository.createEvent(input, actor);
  }

  async updateEvent(id: string, input: VehicleEventUpdateInput, actor: VehicleEventActor): Promise<VehicleEvent> {
    requireActor(actor);
    return this.repository.updateEvent(id, input, actor);
  }

  async deleteEvent(id: string, actor: VehicleEventActor): Promise<void> {
    requireActor(actor);
    return this.repository.deleteEvent(id, actor);
  }

  async getVehicleEvents(vehicleId: string): Promise<VehicleEvent[]> {
    return this.repository.getVehicleEvents(vehicleId);
  }

  async getModuleEvents(sourceModule: string): Promise<VehicleEvent[]> {
    return this.repository.getModuleEvents(sourceModule);
  }

  async searchEvents(filter: VehicleEventFilter): Promise<VehicleEventListResult> {
    return this.repository.searchEvents(filter);
  }

  async getEventDefinitionByCode(eventCode: string): Promise<EventDefinition | null> {
    return this.repository.getEventDefinitionByCode(eventCode);
  }
}
