/**
 * NTR post-create Warranty/vehicle/PM orchestration (ADR-028, business-
 * domain correction) — everything that must happen once an NTR record
 * exists. Historically shared by two NTR-creation paths - the manual
 * `/api/ntr-records` route, and (until its retirement, ADR-038,
 * 2026-07-16) Historical NTR Import's `commitLegacyImportRow` - so both
 * callers ran the exact same logic instead of duplicating it; only the
 * manual route remains today. NTR is the ownership-transfer event and the
 * sole legitimate trigger for Warranty Activation (never manual) and for
 * the PM schedule being proactively resolved.
 *
 * Non-blocking by design: an NTR record must never fail to exist because
 * this orchestration failed - every step below is best-effort, logged on
 * failure, never rethrown to the caller. "Creates Customer ownership" and
 * "triggers Notifications" remain Reserved for Future Capability (no
 * Customer/Ownership domain, no Notification service exist in this
 * platform yet) - not performed here, not fabricated.
 */
import type { Role } from '@/lib/types';
import { getVehicleBySerial, updateVehicleDeliveryInfo, resolveVehicleProgramVersionStages } from '@/lib/db';
import { UNRESTRICTED_SCOPE } from '@/lib/dealerBranchScope';
import { DeliveryService } from '@/features/delivery';
import type { NtrRecord } from '../types';

export interface NtrPostCreateActor {
  username: string;
  role?: Role;
}

/** Warranty Activation + `vehicles.delivery_date`/`product_family_id` +
 *  PM schedule resolution - identical for every NTR-creation path. A
 *  no-op (not an error) when the NTR's own `serial` has no matching
 *  Machine Registry row - a data-integrity edge case, not a normal flow. */
export async function runNtrWarrantyOrchestration(
  record: NtrRecord,
  actor: NtrPostCreateActor,
  deliveryService: DeliveryService = new DeliveryService()
): Promise<void> {
  try {
    const vehicle = await getVehicleBySerial(record.serial, UNRESTRICTED_SCOPE);
    if (!vehicle) return;

    await updateVehicleDeliveryInfo(vehicle.id, {
      deliveryDate: record.delivery_date,
      productFamilyId: record.product_family_id,
      dealerId: record.dealer_id,
      branchId: record.branch_id,
    });
    await deliveryService.activateWarrantyFromNtr(
      { vehicleId: vehicle.id, serial: record.serial, dealerId: record.dealer_id, ntrId: record.id, deliveryDate: record.delivery_date },
      actor
    );
    if (record.product_family_id) {
      // Program version must be resolved as of the vehicle's actual delivery
      // date, never `retail_date` (legacy/import-only, always null for
      // records created via the current manual form - see Bug 4/Warranty
      // Start fix). Falling back to "now" here would pick the wrong
      // maintenance program version for a backdated delivery.
      await resolveVehicleProgramVersionStages(vehicle.id, record.product_family_id, record.delivery_date);
    }
  } catch (err) {
    console.error('NTR post-create warranty/PM orchestration error', err);
  }
}
