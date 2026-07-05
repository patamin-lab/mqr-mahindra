import { describe, it, expect } from 'vitest';
import { formatImportError, formatUnsupportedTemplateMessage } from '../ImportErrorFormatter';

const fieldLabels = { dealer_id: 'Dealer Code', serial: 'Product Serial Number' };

describe('formatImportError', () => {
  it('rewrites an "Unknown X" technical message into a business-facing one', () => {
    expect(formatImportError('Unknown dealer_id "D9"', { fieldLabels })).toBe(
      'Dealer Code column contains an invalid value: "D9".'
    );
  });

  it('rewrites a "Missing X" technical message', () => {
    expect(formatImportError('Missing serial', { fieldLabels })).toBe('Product Serial Number is required but was left blank.');
  });

  it('rewrites the duplicate-detection message', () => {
    expect(formatImportError('Already registered as NTR-D1-2026-000001', { fieldLabels })).toBe(
      'This tractor is already registered (NTR-D1-2026-000001).'
    );
  });

  it('rewrites the DUPLICATE_NTR transactional race message', () => {
    expect(formatImportError('DUPLICATE_NTR: tractor serial ABC123 is already registered', { fieldLabels })).toBe(
      'Tractor serial ABC123 was registered by another import or user just before this one completed.'
    );
  });

  it('falls back to the original text when no pattern matches', () => {
    expect(formatImportError('Some unrecognized error', { fieldLabels })).toBe('Some unrecognized error');
  });

  it('falls back to the raw field key when no label is supplied for it', () => {
    expect(formatImportError('Missing unknown_field', { fieldLabels })).toBe('unknown_field is required but was left blank.');
  });
});

describe('formatUnsupportedTemplateMessage', () => {
  it('returns a fixed business-facing rejection message', () => {
    expect(formatUnsupportedTemplateMessage()).toBe('Uploaded file is not a supported import template.');
  });
});
