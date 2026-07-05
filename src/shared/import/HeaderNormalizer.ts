/**
 * Universal Import Framework — header normalization.
 *
 * Turns a raw header cell ("Dealer Code", "Dealer_ID", "dealer-code ") into
 * a comparable key, so `ColumnMappingService` can match any of a field's
 * declared aliases regardless of the casing/separator/whitespace a
 * dealer's spreadsheet happens to use.
 */
export function normalizeHeader(text: string): string {
  return text
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}
