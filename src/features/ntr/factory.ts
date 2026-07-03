/**
 * Real-dependency wiring for the NTR service - the one place every API
 * route constructs a working `NtrService` from, so the Platform Event
 * Framework wiring (`createVehicleEventPublisher()`) isn't repeated in
 * every route file.
 */
import { SupabaseNtrRepository } from './repositories/supabaseNtrRepository';
import { SupabaseNtrImportSessionRepository } from './repositories/supabaseNtrImportSessionRepository';
import { NtrService } from './services/ntrService';
import { NtrImportService } from './services/ntrImportService';
import { createVehicleEventPublisher } from '@/features/vehicle-event/factory';

export function createNtrService(): NtrService {
  return new NtrService(new SupabaseNtrRepository(), createVehicleEventPublisher());
}

export function createNtrImportService(): NtrImportService {
  return new NtrImportService(createNtrService(), new SupabaseNtrRepository(), new SupabaseNtrImportSessionRepository());
}
