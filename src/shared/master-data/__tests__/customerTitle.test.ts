import { describe, it, expect } from 'vitest';
import { CUSTOMER_TITLE_VALUES, CUSTOMER_TITLE_LABELS_TH, normalizeCustomerTitle } from '../lookup/customerTitle';

describe('Lookup Platform - Customer Title', () => {
  it('normalizes a Thai honorific label back to its canonical value', () => {
    expect(normalizeCustomerTitle('นาย')).toBe('Mr');
    expect(normalizeCustomerTitle('นาง')).toBe('Mrs');
    expect(normalizeCustomerTitle('นางสาว')).toBe('Ms');
  });

  it('normalizes an English abbreviation case-insensitively', () => {
    expect(normalizeCustomerTitle('mr.')).toBe('Mr');
    expect(normalizeCustomerTitle('MS')).toBe('Ms');
  });

  it('returns null for an unrecognized value', () => {
    expect(normalizeCustomerTitle('Dr.')).toBeNull();
    expect(normalizeCustomerTitle('')).toBeNull();
  });

  it('has a Thai label for every value', () => {
    for (const v of CUSTOMER_TITLE_VALUES) expect(CUSTOMER_TITLE_LABELS_TH[v]).toBeTruthy();
  });
});
