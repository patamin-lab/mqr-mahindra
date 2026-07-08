import { describe, it, expect } from 'vitest';
import { CUSTOMER_TYPE_VALUES, CUSTOMER_TYPE_LABELS_TH, normalizeCustomerType } from '../lookup/customerType';

describe('Lookup Platform - Customer Type', () => {
  it('exposes exactly Individual/Company as the canonical values', () => {
    expect(CUSTOMER_TYPE_VALUES).toEqual(['Individual', 'Company']);
  });

  it('normalizes the canonical English value unchanged', () => {
    expect(normalizeCustomerType('Individual')).toBe('Individual');
    expect(normalizeCustomerType('Company')).toBe('Company');
  });

  it('normalizes case-insensitively', () => {
    expect(normalizeCustomerType('individual')).toBe('Individual');
    expect(normalizeCustomerType('COMPANY')).toBe('Company');
  });

  it('normalizes the Thai label', () => {
    expect(normalizeCustomerType(CUSTOMER_TYPE_LABELS_TH.Individual)).toBe('Individual');
    expect(normalizeCustomerType(CUSTOMER_TYPE_LABELS_TH.Company)).toBe('Company');
  });

  it('returns null for an unrecognized value rather than guessing', () => {
    expect(normalizeCustomerType('nonsense')).toBeNull();
  });
});
