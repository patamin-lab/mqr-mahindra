import Papa from 'papaparse';

/**
 * Live read-only integration with the company's existing "Tractor IN" Google
 * Sheet (warehouse intake master list). The sheet must be shared as
 * "Anyone with the link: Viewer" - we read it via the public gviz CSV export
 * endpoint, no Google API key/service account needed.
 *
 * This sheet has no customer/dealer/delivery-date columns - it only
 * confirms a serial is a real unit and supplies its model/engine/product
 * code. Delivery date (for warranty calc) still comes from the Supabase
 * `vehicles` table when available - see the merge logic in
 * src/app/api/vehicles/[serial]/route.ts.
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
  // Row 0 is the header: No. | Product Serial Number | Engine Serial Number |
  // Product Code | Product Model | WH Arrival Date | PDI Status
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
