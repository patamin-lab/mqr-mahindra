/**
 * MASP Platform — Lookup Platform: Customer Type.
 *
 * The one source of truth for the `Individual`/`Company` (`บุคคลธรรมดา`/
 * `นิติบุคคล`) lookup - previously a centralized *type* (`NtrCustomerType`
 * in `features/ntr/types`) but with the literal values re-typed as raw
 * strings in three separate call sites (the manual create form, the zod
 * validation schema, and the import normalizer). Any module offering this
 * lookup (a dropdown, a validator, an import-column normalizer) imports
 * `CUSTOMER_TYPE_VALUES`/`CUSTOMER_TYPE_LABELS`/`normalizeCustomerType`
 * from here instead of re-typing `'Individual'`/`'Company'` again.
 */
export type CustomerType = 'Individual' | 'Company';

export const CUSTOMER_TYPE_VALUES: CustomerType[] = ['Individual', 'Company'];

export const CUSTOMER_TYPE_LABELS_TH: Record<CustomerType, string> = {
  Individual: 'บุคคลธรรมดา',
  Company: 'นิติบุคคล',
};

export const CUSTOMER_TYPE_LABELS_EN: Record<CustomerType, string> = {
  Individual: 'Individual',
  Company: 'Company',
};

/** Accepts the canonical English value or either language's Thai/English
 *  free-text label (case-insensitive) - the same normalization NTR's
 *  import previously did inline, now shared. Returns `null` for anything
 *  unrecognized rather than guessing. */
export function normalizeCustomerType(value: string): CustomerType | null {
  const v = value.trim().toLowerCase();
  if (v === 'individual' || v === CUSTOMER_TYPE_LABELS_TH.Individual) return 'Individual';
  if (v === 'company' || v === CUSTOMER_TYPE_LABELS_TH.Company) return 'Company';
  return null;
}
