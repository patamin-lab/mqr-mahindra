/**
 * MASP Platform — Lookup Platform: Customer Title (honorific prefix).
 *
 * Canonical list every module capturing a customer's name goes through -
 * previously a free-text field in NTR's registration form with no
 * controlled vocabulary at all.
 */
export type CustomerTitle = 'Mr' | 'Mrs' | 'Ms';

export const CUSTOMER_TITLE_VALUES: CustomerTitle[] = ['Mr', 'Mrs', 'Ms'];

export const CUSTOMER_TITLE_LABELS_TH: Record<CustomerTitle, string> = {
  Mr: 'นาย',
  Mrs: 'นาง',
  Ms: 'นางสาว',
};

export const CUSTOMER_TITLE_LABELS_EN: Record<CustomerTitle, string> = {
  Mr: 'Mr.',
  Mrs: 'Mrs.',
  Ms: 'Ms.',
};

export function normalizeCustomerTitle(value: string): CustomerTitle | null {
  const v = value.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  if (v === CUSTOMER_TITLE_LABELS_TH.Mr || lower === 'mr' || lower === 'mr.') return 'Mr';
  if (v === CUSTOMER_TITLE_LABELS_TH.Mrs || lower === 'mrs' || lower === 'mrs.') return 'Mrs';
  if (v === CUSTOMER_TITLE_LABELS_TH.Ms || lower === 'ms' || lower === 'ms.' || lower === 'miss') return 'Ms';
  return null;
}
