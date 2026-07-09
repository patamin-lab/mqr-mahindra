import Papa from 'papaparse';

/**
 * Live read-only integration with the company's existing "Tractor IN" Google
 * Sheet (warehouse intake master list). The sheet must be shared as
 * "Anyone with the link: Viewer" - we read it via the public gviz CSV export
 * endpoint, no Google API key/service account needed.
 *
 * The live sheet's real current header row (confirmed 2026-07-09 by
 * fetching the CSV directly - this doc comment previously listed only 7
 * columns, which was stale relative to the sheet's actual state; verify
 * against the real sheet before changing this list again, never against
 * this comment alone):
 *
 *   No. | Product Serial Number | Engine Serial Number | Product Code |
 *   Product Model | WH Arrival Date | PDI Status | วันที่ส่งมอบ
 *   (Delivery Date, Thai) | Dealer
 *
 * `deliveryDateThai`/`dealer` (columns 8/9, 0-indexed 7/8) are pre-existing
 * sheet columns, exposed here for completeness - neither is currently
 * consumed by application code.
 *
 * `productFamily`/`subModel` (columns 10/11, 0-indexed 9/10) are the
 * Tractor IN sync's source of truth for `vehicles.product_family_id`/
 * `vehicles.sub_model` (see `features/vehicle/services/
 * tractorInSyncService.ts`) - a manual prerequisite still to be added to
 * the live sheet; until they exist, both simply read as an empty string
 * (same graceful-absence handling every other column here already has).
 */

const SHEET_ID = process.env.TRACTOR_SHEET_ID || '1v9AQRoBaOKCxp2W3IwG7H3895yCnjhLyJy3yh34zq84';
const SHEET_GID = process.env.TRACTOR_SHEET_GID || '725775394';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_GID}`;

export interface TractorInRow {
  no: string;
  productSerial: string;
  engineSerial: string;
  productCode: string;
  productModel: string;
  whArrivalDate: string;
  pdiStatus: string;
  /** วันที่ส่งมอบ (Delivery Date, Thai) - pre-existing sheet column, not
   *  currently consumed anywhere. */
  deliveryDateThai: string;
  /** Pre-existing sheet column, not currently consumed anywhere. */
  dealer: string;
  /** Must match an existing `product_families.code` or `.name` exactly -
   *  the sync service never guesses/creates a Product Family. */
  productFamily: string;
  subModel: string;
}

let cache: { rows: TractorInRow[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes - balances freshness vs. hammering Google on every lookup

function normalizeSerial(s: string | null | undefined): string {
  return (s ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

async function fetchRows(): Promise<TractorInRow[]> {
  const res = await fetch(CSV_URL, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`อ่านชีท Tractor IN ไม่สำเร็จ (HTTP ${res.status})`);
  }
  const text = await res.text();
  const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
  const rows = (parsed.data as string[][]) ?? [];
  // Row 0 is the header - see this file's module doc comment for the full,
  // verified-against-the-real-sheet column list. Columns 10/11 (Product
  // Family/Sub Model) are a manual prerequisite not yet added - read as ''
  // until they exist.
  return rows
    .slice(1)
    .filter((r) => Array.isArray(r) && r[1])
    .map((r) => ({
      no: (r[0] ?? '').trim(),
      productSerial: (r[1] ?? '').trim(),
      engineSerial: (r[2] ?? '').trim(),
      productCode: (r[3] ?? '').trim(),
      productModel: (r[4] ?? '').trim(),
      whArrivalDate: (r[5] ?? '').trim(),
      pdiStatus: (r[6] ?? '').trim(),
      deliveryDateThai: (r[7] ?? '').trim(),
      dealer: (r[8] ?? '').trim(),
      productFamily: (r[9] ?? '').trim(),
      subModel: (r[10] ?? '').trim(),
    }));
}

export async function getTractorInRows(): Promise<TractorInRow[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) return cache.rows;
  try {
    const rows = await fetchRows();
    cache = { rows, fetchedAt: now };
    return rows;
  } catch (err) {
    console.error('tractor sheet fetch error', err);
    if (cache) return cache.rows; // serve stale data rather than fail the lookup outright
    return [];
  }
}

export async function lookupTractorBySerial(serial: string): Promise<TractorInRow | null> {
  const target = normalizeSerial(serial);
  if (!target) return null;
  const rows = await getTractorInRows();
  return rows.find((r) => normalizeSerial(r.productSerial) === target) ?? null;
}

/** Substring match across cached Tractor IN rows - powers the report form's smart search. */
export async function lookupTractorBySerialPartial(term: string, limit = 20): Promise<TractorInRow[]> {
  const target = normalizeSerial(term);
  if (!target) return [];
  const rows = await getTractorInRows();
  return rows.filter((r) => normalizeSerial(r.productSerial).includes(target)).slice(0, limit);
}
