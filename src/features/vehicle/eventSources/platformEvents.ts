/**
 * Vehicle Life Cycle event source — Platform Event Framework
 * (`vehicle_events`/`event_definitions`, see
 * `src/features/vehicle-event/`).
 *
 * Generic by design: any module that publishes through
 * `VehicleEventPublisher` (NTR is the first real one) appears on the
 * timeline automatically via this one adapter, keyed off the
 * `event_code` the publisher now echoes into `metadata` (see
 * `publisher.ts`'s `publish()`) - a future module does not need its own
 * bespoke event-source file the way MQR/Maintenance do, unless it needs
 * something this generic mapping can't express.
 */
import { getVehicleBySerial } from '@/lib/db';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { SessionUser } from '@/lib/types';
import { createVehicleEventService } from '@/features/vehicle-event/factory';
import { VehicleEvent as PlatformEvent } from '@/features/vehicle-event/types';
import { VehicleEvent, VehicleEventType } from '../types';

const EVENT_CODE_TO_TYPE: Record<string, VehicleEventType> = {
  FACTORY_BUILD: 'FactoryBuild',
  DEALER_RECEIVED: 'DealerReceive',
  PDI_COMPLETED: 'PdiCompleted',
  NTR_CREATED: 'NtrCreated',
  NTR_COMPLETED: 'NtrCompleted',
  MAINTENANCE_COMPLETED: 'MaintenanceCompleted',
  MQR_OPENED: 'MqrOpened',
  MQR_CLOSED: 'MqrClosed',
  CAMPAIGN_ASSIGNED: 'CampaignAssigned',
  CAMPAIGN_COMPLETED: 'CampaignCompleted',
  PART_REQUESTED: 'PartsRequested',
  PART_DELIVERED: 'PartsDelivered',
  INSPECTION: 'Inspection',
  RELEASED_TO_DEALER: 'ReleasedToDealer',
  WARRANTY_ACTIVATED: 'WarrantyActivated',
};

/** Module -> detail-page href builder. A module not listed here (not yet
 *  built) still renders on the timeline, just without a working link -
 *  correct behavior, not a bug, since that module's pages don't exist yet. */
const HREF_BY_MODULE: Record<string, (referenceId: string) => string> = {
  ntr: (referenceId) => `/ntr/${encodeURIComponent(referenceId)}`,
};

function mapPlatformEvent(event: PlatformEvent): VehicleEvent {
  const eventCode = typeof event.metadata?.event_code === 'string' ? event.metadata.event_code : null;
  const type = (eventCode && EVENT_CODE_TO_TYPE[eventCode]) || 'Other';
  const hrefBuilder = HREF_BY_MODULE[event.source_module];
  return {
    type,
    date: event.event_datetime,
    referenceNumber: event.reference_id,
    description: event.title,
    user: event.created_by,
    status: event.status,
    href: hrefBuilder ? hrefBuilder(event.reference_id) : '#',
  };
}

export async function getPlatformEvents(serial: string, session: SessionUser): Promise<VehicleEvent[]> {
  // Vehicles are dealer-level master data - scoped to dealer only (see
  // vehicle/service.ts's comment). `vehicle_events` itself has no
  // dealer_id/branch_id column (only `reference_id` back to the source
  // module's own record), so a DealerUser may see a generic timeline
  // entry (date/title only, no customer PII) for an event whose full
  // record lives in a sibling branch - clicking through to that record's
  // detail page is independently blocked by that module's own branch
  // check. Full per-event branch filtering would require joining back to
  // each source module's table by reference_id - out of scope here.
  const vehicle = await getVehicleBySerial(serial, resolveDealerScope(session, null));
  if (!vehicle) return [];

  const events = await createVehicleEventService().getVehicleEvents(vehicle.id);
  return events.map(mapPlatformEvent);
}
