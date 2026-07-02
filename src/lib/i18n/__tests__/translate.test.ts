import { describe, it, expect } from 'vitest';
import { translate } from '../translate';

describe('translate', () => {
  it('resolves a dotted key path against the requested locale', () => {
    expect(translate('th', 'common.vehicle')).toBe('รถ');
    expect(translate('en', 'common.vehicle')).toBe('Vehicle');
  });

  it('resolves nested namespaces (pdf/csv/status/etc.)', () => {
    expect(translate('th', 'pdf.mqrTitle')).toContain('ใบรายงานปัญหาคุณภาพ');
    expect(translate('en', 'csv.customerName')).toBe('Customer');
    expect(translate('th', 'mqrStatus.WaitingCustomer')).toBe('รอข้อมูลจากลูกค้า');
  });

  it('interpolates {var} placeholders', () => {
    expect(translate('en', 'validation.requiredField', { field: 'phone number' })).toBe(
      'Please enter phone number'
    );
    expect(translate('th', 'validation.requiredField', { field: 'ชื่อลูกค้า' })).toBe(
      'กรุณากรอก ชื่อลูกค้า'
    );
  });

  it('leaves an unmatched {var} placeholder untouched rather than crashing', () => {
    expect(translate('en', 'validation.requiredField', {})).toBe('Please enter {field}');
  });

  it('returns the raw key when the key exists in neither locale', () => {
    expect(translate('th', 'nope.nope.nope')).toBe('nope.nope.nope');
  });
});
