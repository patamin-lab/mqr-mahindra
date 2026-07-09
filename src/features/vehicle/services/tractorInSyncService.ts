/**
 * Tractor IN Sync Service.
 *
 * The single, dedicated path that writes Product Family / Sub Model from
 * the Tractor IN Google Sheet into `vehicles.product_family_id`/
 * `vehicles.sub_model`. No other module (NTR, PM, any lookup/search route)
 * may write these two columns - they only ever read them. This keeps
 * synchronization entirely out of request-time lookups (no read-through
 * upsert), matching the "one synchronization path" requirement.
 *
 * Triggered manually today (`POST /api/admin/tractor-in/sync`,
 * SuperAdmin-gated) since no scheduler platform exists yet in this repo
 * (per `docs/architecture/PLATFORM_CONSTITUTION.md`'s Platform service
 * boundaries section, listing `scheduler` as not-yet-built) - a scheduled
 * trigger can be added later without changing this service's shape.
 *
 * Product Family resolution matches the sheet's `Product Family` text
 * against `product_families.code`/`.name` exactly (case-insensitive,
 * trimmed) - a row whose text doesn't match anything real is reported as
 * unmatched, never silently guessed or auto-created.
 */
import { getSupabase } from '@/lib/supabase';
import { getTractorInRows } from '@/lib/tractorSheet';
import { listActiveProductFamilies } from '@/lib/db';

export interface TractorInSyncUnmatched {
  serial: string;
  productFamilyText: string;
}

export interface TractorInSyncResult {
  totalRows: number;
  skippedNoSerial: number;
  updated: number;
  unmatchedProductFamily: TractorInSyncUnmatched[];
}

export class TractorInSyncService {
  async sync(): Promise<TractorInSyncResult> {
    const [rows, families] = await Promise.all([getTractorInRows(), listActiveProductFamilies()]);

    const familyIdByKey = new Map<string, string>();
    for (const f of families) {
      familyIdByKey.set(f.code.trim().toLowerCase(), f.id);
      familyIdByKey.set(f.name.trim().toLowerCase(), f.id);
    }

    const supabase = getSupabase();
    let updated = 0;
    let skippedNoSerial = 0;
    const unmatchedProductFamily: TractorInSyncUnmatched[] = [];

    for (const row of rows) {
      const serial = row.productSerial.trim();
      if (!serial) {
        skippedNoSerial += 1;
        continue;
      }

      const productFamilyText = row.productFamily.trim();
      const subModel = row.subModel.trim();

      let productFamilyId: string | null = null;
      if (productFamilyText) {
        productFamilyId = familyIdByKey.get(productFamilyText.toLowerCase()) ?? null;
        if (!productFamilyId) unmatchedProductFamily.push({ serial, productFamilyText });
      }

      // Nothing in this row is syncable yet (sheet doesn't have the new
      // columns populated for this tractor) - skip rather than write an
      // all-null no-op update.
      if (!productFamilyId && !subModel) continue;

      const updatePayload: { product_family_id?: string; sub_model?: string } = {};
      if (productFamilyId) updatePayload.product_family_id = productFamilyId;
      if (subModel) updatePayload.sub_model = subModel;

      const { error, count } = await supabase
        .from('vehicles')
        .update(updatePayload, { count: 'exact' })
        .eq('serial', serial);
      if (error) throw error;
      if (count && count > 0) updated += 1;
    }

    return { totalRows: rows.length, skippedNoSerial, updated, unmatchedProductFamily };
  }
}
