/**
 * Vehicle Event — repository interface.
 *
 * Defines the data-access contract only; see `supabaseRepository.ts` for the
 * Supabase-backed adapter. Mirrors the `MaintenanceRepository` shape/pattern
 * from `src/features/maintenance/repositories/maintenanceRepository.ts`.
 */
import {
  EventDefinition,
  VehicleEvent,
  VehicleEventActor,
  VehicleEventCreateInput,
  VehicleEventFilter,
  VehicleEventListResult,
  VehicleEventUpdateInput,
} from './types';

export interface VehicleEventRepository {
  createEvent(input: VehicleEventCreateInput, actor: VehicleEventActor): Promise<VehicleEvent>;
  updateEvent(id: string, input: VehicleEventUpdateInput, actor: VehicleEventActor): Promise<VehicleEvent>;
  /** Soft delete only - never a hard delete (record_status=Deleted, matches
   *  every other business table in this app). */
  deleteEvent(id: string, actor: VehicleEventActor): Promise<void>;
  getVehicleEvents(vehicleId: string): Promise<VehicleEvent[]>;
  getModuleEvents(sourceModule: string): Promise<VehicleEvent[]>;
  /** Server-side paginated/filtered/searchable query - the only method the
   *  public `/api/platform/events` GET route uses, since it's the one path
   *  that enforces dealer scope via a join back to `vehicles`. */
  searchEvents(filter: VehicleEventFilter): Promise<VehicleEventListResult>;
  getEventDefinitionByCode(eventCode: string): Promise<EventDefinition | null>;
}
