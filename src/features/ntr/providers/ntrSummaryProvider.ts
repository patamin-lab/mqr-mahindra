/**
 * NtrSummaryProvider — this module's contribution to Vehicle 360.
 *
 * Implements `VehicleSummaryProvider` (owned by `vehicle/types.ts`) so
 * Vehicle 360 never needs to import anything from this module directly.
 * NTR is the authoritative source of "current owner" (the customer this
 * tractor was actually delivered to) - registered ahead of Maintenance's
 * own contribution in `VEHICLE_SUMMARY_PROVIDERS` so a real NTR customer
 * always wins over a PM visit's incidental customer-name field; a vehicle
 * with no NTR on file yet (e.g. legacy stock not re-registered) still
 * falls back to whatever Maintenance/MQR know, unchanged.
 */
import { getSupabase } from '@/lib/supabase';
import { SessionUser } from '@/lib/types';
import { seesAllDealers } from '@/lib/scope';
import { VehicleSummary, VehicleSummaryProvider } from '@/features/vehicle/types';

export class NtrSummaryProvider implements VehicleSummaryProvider {
  async getVehicleSummary(serial: string, session: SessionUser): Promise<Partial<VehicleSummary> | null> {
    const client = getSupabase();
    let query = client
      .from('ntr_records')
      .select('customer_name, customer_phone, dealer_id')
      .eq('record_status', 'Active')
      .eq('serial', serial)
      .order('created_at', { ascending: false })
      .limit(1);
    if (!seesAllDealers(session.role) && session.dealerId) {
      query = query.eq('dealer_id', session.dealerId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      ownerName: data.customer_name ?? null,
      ownerPhone: data.customer_phone ?? null,
    };
  }
}
