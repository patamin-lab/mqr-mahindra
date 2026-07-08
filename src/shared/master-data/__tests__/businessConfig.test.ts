import { describe, it, expect, afterEach } from 'vitest';
import { getWarrantyLimitMonths } from '../config/businessConfig';

describe('Configuration Platform - warranty limit months', () => {
  afterEach(() => {
    delete process.env.WARRANTY_POWERTRAIN_MONTHS;
    delete process.env.WARRANTY_GENERAL_MONTHS;
  });

  it('defaults to 48 months for powertrain', () => {
    expect(getWarrantyLimitMonths('powertrain')).toBe(48);
  });

  it('defaults to 24 months for other systems', () => {
    expect(getWarrantyLimitMonths('other')).toBe(24);
  });

  it('honors an env override, read lazily at call time', () => {
    process.env.WARRANTY_POWERTRAIN_MONTHS = '60';
    expect(getWarrantyLimitMonths('powertrain')).toBe(60);
  });

  it('falls back to the default if the env override is not a valid number', () => {
    process.env.WARRANTY_GENERAL_MONTHS = 'not-a-number';
    expect(getWarrantyLimitMonths('other')).toBe(24);
  });
});
