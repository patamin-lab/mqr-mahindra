/**
 * Universal Import Framework — Import Contract.
 *
 * The single object a module hands the framework to describe its import
 * template: `module`, `templateVersion`, and its field list (from which
 * required/optional/alias views are derived, never stored separately -
 * one source of truth, no risk of `requiredFields`/`optionalFields`
 * drifting from the field list itself). Every generic piece of the
 * framework (`ColumnMappingService`, `ImportParser`'s column resolution,
 * `ImportTemplateService`, `ImportTemplateValidator`) depends on this
 * contract and nothing else about a module - no module-specific import
 * ever reaches these files.
 */
import { ImportFieldDefinition } from './types';

/** Field-level validation beyond `parse`'s type coercion - e.g. a format
 *  check that doesn't change the value, just whether it's acceptable.
 *  Optional; business validation (master-data lookups, duplicate
 *  detection) still lives entirely in the module's own service, never
 *  here - this is for validation that is purely about one field's shape
 *  and needs no database/repository access. */
export interface ImportValidator {
  field: string;
  /** Returns an error message when invalid, `undefined` when the value is
   *  acceptable. Receives the already-coerced value and the full row (for
   *  cross-field checks, e.g. "customer_name required unless first/last
   *  name given"). */
  validate: (value: unknown, row: Record<string, unknown>) => string | undefined;
}

export interface ImportContract {
  module: string;
  templateName: string;
  templateVersion: string;
  fields: ImportFieldDefinition[];
  validators?: ImportValidator[];
}

export function requiredFieldsOf(contract: ImportContract): ImportFieldDefinition[] {
  return contract.fields.filter((f) => f.required);
}

export function optionalFieldsOf(contract: ImportContract): ImportFieldDefinition[] {
  return contract.fields.filter((f) => !f.required);
}

/** Canonical field key -> every alias that resolves to it, including the
 *  field's own `canonicalKey`/`displayLabel` - the same alias set
 *  `ColumnMappingService` matches headers against, exposed here for a
 *  module that wants to inspect its own contract (e.g. building an
 *  Instructions sheet listing every recognized synonym). */
export function aliasesOf(contract: ImportContract): Record<string, string[]> {
  return Object.fromEntries(contract.fields.map((f) => [f.canonicalKey, [f.canonicalKey, f.displayLabel, ...f.aliases]]));
}
