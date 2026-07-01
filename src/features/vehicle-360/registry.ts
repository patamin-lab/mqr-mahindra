/**
 * Vehicle Life Cycle event registry.
 *
 * The ONLY file a future module (PDI/NTR/Campaign/Parts Request/...) needs
 * to touch to appear on the Vehicle 360 timeline: add its
 * `VehicleEventSource` function here. `service.ts`'s aggregation/sorting
 * code never changes when a new source is added.
 */
import { VehicleEventSource } from './types';
import { getMaintenanceEvents } from './eventSources/maintenanceEvents';
import { getMqrEvents } from './eventSources/mqrEvents';

export const VEHICLE_EVENT_SOURCES: VehicleEventSource[] = [getMaintenanceEvents, getMqrEvents];
