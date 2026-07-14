/**
 * Vehicle Event — Platform Service shared types.
 *
 * Vehicle Event is no longer a PM Record feature: it's the Platform Event
 * Framework backbone for the whole Mahindra After Sales Platform. Every
 * business module (Maintenance, MQR, and future PDI/NTR/Campaign/Parts
 * Request/...) is meant to publish through `VehicleEventPublisher` - never
 * write to `vehicle_events` directly - so the table stores only a reference
 * back to the module that owns the real business record (`source_module` +
 * `reference_id`), never a duplicate copy of it.
 */

export const EVENT_CODES = [
  'FACTORY_BUILD',
  'DEALER_RECEIVED',
  'PDI_COMPLETED',
  'NTR_CREATED',
  'NTR_COMPLETED',
  'MAINTENANCE_COMPLETED',
  'MQR_OPENED',
  'MQR_CLOSED',
  'CAMPAIGN_ASSIGNED',
  'CAMPAIGN_COMPLETED',
  'PART_REQUESTED',
  'PART_DELIVERED',
  'INSPECTION',
  'SOFTWARE_UPDATE',
  'RECALL',
  'TELEMATICS_ALERT',
  'RELEASED_TO_DEALER',
  'WARRANTY_ACTIVATED',
  'OTHER',
] as const;

export type EventCode = (typeof EVENT_CODES)[number];

/** Event Definition Master row - `vehicle_events` stores `event_definition_id`
 *  (a real FK), never the `event_code` string, per spec. */
export interface EventDefinition {
  id: string;
  event_code: EventCode;
  display_name_en: string;
  display_name_th: string;
  module: string;
  icon: string | null;
  color: string | null;
  display_order: number;
  active: boolean;
}

export interface VehicleEvent {
  id: string;
  vehicle_id: string;
  event_definition_id: string;
  source_module: string;
  reference_id: string;
  event_datetime: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  status: string | null;
  created_by: string | null;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
  record_status: 'Active' | 'Deleted';
}

/** Shape accepted by `VehicleEventRepository.createEvent()` /
 *  `VehicleEventService.createEvent()` - both `vehicle_id` and
 *  `event_definition_id` must already be resolved (never a serial or an
 *  event_code) by this point; that resolution is `VehicleEventPublisher`'s
 *  job, one layer up. */
export interface VehicleEventCreateInput {
  vehicle_id: string;
  event_definition_id: string;
  source_module: string;
  reference_id: string;
  event_datetime: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
  status?: string | null;
}

export interface VehicleEventUpdateInput {
  event_datetime?: string;
  title?: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  status?: string | null;
}

export interface VehicleEventFilter {
  /** Dealer scope, resolved via a join back to `vehicles.dealer_id` -
   *  `vehicle_events` itself has no `dealer_id` column (per spec's column
   *  list), but the "every query enforces dealer scope" rule still applies
   *  to this table like every other one in the app. */
  dealerId?: string | null;
  vehicleId?: string | null;
  sourceModule?: string | null;
  eventDefinitionId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  search?: string | null;
  page: number;
  pageSize: number;
}

export interface VehicleEventListResult {
  data: VehicleEvent[];
  total: number;
}

export interface VehicleEventActor {
  username: string;
}
