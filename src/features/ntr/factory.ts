/**
 * Real-dependency wiring for the NTR service - the one place every API
 * route constructs a working `NtrService` from, so the Platform Event
 * Framework wiring (`createVehicleEventPublisher()`) isn't repeated in
 * every route file.
 */
import { SupabaseNtrRepository } from './repositories/supabaseNtrRepository';
import { NtrService } from './services/ntrService';
import { createVehicleEventPublisher } from '@/features/vehicle-event/factory';

export function createNtrService(): NtrService {
  return new NtrService(new SupabaseNtrRepository(), createVehicleEventPublisher());
}
