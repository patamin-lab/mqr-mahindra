/**
 * Universal Import Framework — column mapping.
 *
 * Matches an uploaded file's header row against a module's declared
 * `ImportFieldDefinition[]` by alias, independent of column order - a
 * module's future template revision can reorder/add columns without
 * breaking older uploaded files, and a dealer's spreadsheet can use any
 * recognized synonym for a field ("Dealer", "Dealer_ID", "DealerCode" all
 * resolve to the same canonical `dealer_id`). Never modifies parser
 * logic (row iteration/type coercion) - this only decides which header
 * cell corresponds to which canonical field.
 */
import { normalizeHeader } from './HeaderNormalizer';
import { ColumnMappingResult, ImportFieldDefinition } from './types';

/** Every alias a field recognizes, including its own `canonicalKey` and
 *  `displayLabel` - callers only need to list genuine synonyms. */
function aliasesFor(field: ImportFieldDefinition): string[] {
  return [field.canonicalKey, field.displayLabel, ...field.aliases];
}

export class ColumnMappingService {
  constructor(private readonly fields: ImportFieldDefinition[]) {}

  /** `headerRow` is the raw header cell text, in file order. Returns the
   *  mapping plus every diagnostic Step 3 needs to display - this never
   *  throws; a completely unmappable file just comes back with every
   *  required field in `missingRequiredColumns`, for the caller to reject
   *  as a business validation failure. */
  mapHeaders(headerRow: string[]): ColumnMappingResult {
    const byNormalizedAlias = new Map<string, ImportFieldDefinition>();
    for (const field of this.fields) {
      for (const alias of aliasesFor(field)) {
        byNormalizedAlias.set(normalizeHeader(alias), field);
      }
    }

    const mapped: ColumnMappingResult['mapped'] = [];
    const unknownColumns: string[] = [];
    const matchedKeys = new Set<string>();

    for (const header of headerRow) {
      const trimmed = header.trim();
      if (!trimmed) continue;
      const field = byNormalizedAlias.get(normalizeHeader(trimmed));
      if (field) {
        mapped.push({ header: trimmed, canonicalKey: field.canonicalKey, displayLabel: field.displayLabel });
        matchedKeys.add(field.canonicalKey);
      } else {
        unknownColumns.push(trimmed);
      }
    }

    const ignoredColumns = this.fields.filter((f) => !f.required && !matchedKeys.has(f.canonicalKey)).map((f) => f.displayLabel);
    const missingRequiredColumns = this.fields.filter((f) => f.required && !matchedKeys.has(f.canonicalKey)).map((f) => f.displayLabel);

    return { mapped, ignoredColumns, unknownColumns, missingRequiredColumns };
  }

  /** Column index (0-based, in `headerRow` order) for a canonical field,
   *  or -1 if that field wasn't present in this particular file - used by
   *  the parser to pull the right cell for each row regardless of the
   *  file's actual column order. */
  columnIndexFor(headerRow: string[], canonicalKey: string): number {
    const field = this.fields.find((f) => f.canonicalKey === canonicalKey);
    if (!field) return -1;
    const aliasSet = new Set(aliasesFor(field).map(normalizeHeader));
    return headerRow.findIndex((h) => aliasSet.has(normalizeHeader(h.trim())));
  }
}
