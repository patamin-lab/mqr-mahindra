/**
 * Real-dependency wiring for the Vehicle Event Platform Service - the one
 * place `/api/platform/events` (and, later, any business module) constructs
 * a working `VehicleEventService`/`VehicleEventPublisher` from.
 */
import { getVehicleBySerial } from '@/lib/db';
import { SupabaseVehicleEventRepository } from './supabaseRepository';
import { VehicleEventService } from './service';
import { VehicleEventPublisher, VehicleLookup } from './publisher';

const vehicleLookup: VehicleLookup = {
  async getVehicleIdBySerial(serial: string) {
    // null dealerId = no dealer-scope narrowing here; resolving "does this
    // serial exist at all" is a lookup, not a scoped business read - the
    // caller (API route) applies its own dealer scope on the event query,
    // same separation PmRecordSearch already relies on for vehicle search.
    const vehicle = await getVehicleBySerial(serial, null);
    return vehicle?.id ?? null;
  },
};

export function createVehicleEventService(): VehicleEventService {
  return new VehicleEventService(new SupabaseVehicleEventRepository());
}

export function createVehicleEventPublisher(): VehicleEventPublisher {
  return new VehicleEventPublisher(createVehicleEventService(), vehicleLookup);
}
