/**
 * Real-dependency wiring for the Vehicle Event Platform Service - the one
 * place `/api/platform/events` (and, later, any business module) constructs
 * a working `VehicleEventService`/`VehicleEventPublisher` from.
 */
import { getVehicleBySerial } from '@/lib/db';
import { UNRESTRICTED_SCOPE } from '@/lib/dealerBranchScope';
import { SupabaseVehicleEventRepository } from './supabaseRepository';
import { VehicleEventService } from './service';
import { VehicleEventPublisher, VehicleLookup } from './publisher';

const vehicleLookup: VehicleLookup = {
  async getVehicleIdBySerial(serial: string) {
    // Unrestricted = no dealer-scope narrowing here; resolving "does this
    // serial exist at all" is a lookup, not a scoped business read - the
    // caller (API route) applies its own dealer scope on the event query,
    // same separation MaintenanceSearch already relies on for vehicle search.
    const vehicle = await getVehicleBySerial(serial, UNRESTRICTED_SCOPE);
    return vehicle?.id ?? null;
  },
};

export function createVehicleEventService(): VehicleEventService {
  return new VehicleEventService(new SupabaseVehicleEventRepository());
}

export function createVehicleEventPublisher(): VehicleEventPublisher {
  return new VehicleEventPublisher(createVehicleEventService(), vehicleLookup);
}
