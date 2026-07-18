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
import { applyScope } from '@/lib/db';
import { VehicleSummary, VehicleSummaryProvider } from '@/features/vehicle/types';

export class NtrSummaryProvider implements VehicleSummaryProvider {
  async getVehicleSummary(serial: string, session: SessionUser): Promise<Partial<VehicleSummary> | null> {
    const client = getSupabase();
    let query = client
      .from('ntr_records')
      .select('customer_name, customer_phone, dealer_id, delivery_date')
      .eq('serial', serial)
      .order('created_at', { ascending: false })
      .limit(1);
    // Dealer/Branch Scope Platform Standard: a DealerUser only sees the
    // "current owner" contribution from an NTR record in their own branch.
    query = applyScope(query, session);
    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      ownerName: data.customer_name ?? null,
      ownerPhone: data.customer_phone ?? null,
      // Compatibility fallback for vehicle rows written before the NTR
      // post-create synchronization completed. The vehicle master remains
      // authoritative whenever it has a value; Vehicle360 only uses these
      // fields when the master row is missing them.
      dealerId: data.dealer_id ?? null,
      retailDate: data.delivery_date ?? null,
      // Tractor Lifecycle foundation (MASP v1.1) - the one rule that
      // exists today: an active NTR on file means the tractor has been
      // delivered. Future modules (PDI, Warranty, Campaign, a retirement
      // flow) extend this by contributing their own lifecycleStatus from
      // their own provider - this file does not grow a dependency on them.
      lifecycleStatus: 'Delivered',
    };
  }
}
