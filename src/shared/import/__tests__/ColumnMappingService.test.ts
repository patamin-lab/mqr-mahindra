import { describe, it, expect } from 'vitest';
import { ColumnMappingService } from '../ColumnMappingService';
import { ImportFieldDefinition } from '../types';

const fields: ImportFieldDefinition[] = [
  { canonicalKey: 'dealer_id', displayLabel: 'Dealer Code', required: true, aliases: ['Dealer', 'Dealer_ID', 'DealerCode'] },
  { canonicalKey: 'serial', displayLabel: 'Product Serial Number', required: true, aliases: ['Serial Number', 'Vehicle Serial', 'Serial'] },
  { canonicalKey: 'model', displayLabel: 'Model', required: false, aliases: [] },
];

describe('ColumnMappingService', () => {
  it('matches a header by any declared alias, case/whitespace/separator-insensitively', () => {
    const service = new ColumnMappingService(fields);
    const result = service.mapHeaders(['dealer_code', 'Serial Number', 'Model']);
    expect(result.mapped).toEqual([
      { header: 'dealer_code', canonicalKey: 'dealer_id', displayLabel: 'Dealer Code' },
      { header: 'Serial Number', canonicalKey: 'serial', displayLabel: 'Product Serial Number' },
      { header: 'Model', canonicalKey: 'model', displayLabel: 'Model' },
    ]);
    expect(result.missingRequiredColumns).toEqual([]);
    expect(result.ignoredColumns).toEqual([]);
    expect(result.unknownColumns).toEqual([]);
  });

  it('reports a required field with no matching header as missing', () => {
    const service = new ColumnMappingService(fields);
    const result = service.mapHeaders(['Dealer', 'Model']);
    expect(result.missingRequiredColumns).toEqual(['Product Serial Number']);
  });

  it('reports an optional field with no matching header as ignored, not missing', () => {
    const service = new ColumnMappingService(fields);
    const result = service.mapHeaders(['Dealer', 'Serial']);
    expect(result.ignoredColumns).toEqual(['Model']);
    expect(result.missingRequiredColumns).toEqual([]);
  });

  it('reports a header matching no field as unknown', () => {
    const service = new ColumnMappingService(fields);
    const result = service.mapHeaders(['Dealer', 'Serial', 'Some Random Column']);
    expect(result.unknownColumns).toEqual(['Some Random Column']);
  });

  it('columnIndexFor resolves a field to its actual position regardless of column order', () => {
    const service = new ColumnMappingService(fields);
    const headerRow = ['Serial Number', 'Dealer_ID', 'Model'];
    expect(service.columnIndexFor(headerRow, 'dealer_id')).toBe(1);
    expect(service.columnIndexFor(headerRow, 'serial')).toBe(0);
    expect(service.columnIndexFor(headerRow, 'model')).toBe(2);
  });

  it('columnIndexFor returns -1 for a field absent from this file', () => {
    const service = new ColumnMappingService(fields);
    expect(service.columnIndexFor(['Dealer', 'Serial'], 'model')).toBe(-1);
  });
});
