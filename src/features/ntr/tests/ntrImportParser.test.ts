import { describe, it, expect } from 'vitest';
import { mapNtrImportHeaders, parseNtrImportFile } from '../services/ntrImportParser';

/** Regression coverage for the alias-based rewrite of the parser (see
 *  docs/engineering/IMPORT_FRAMEWORK.md) - the old parser read columns by
 *  fixed position; this one resolves each field by alias, so column order
 *  and header spelling must no longer matter. */
describe('parseNtrImportFile (CSV, alias-based column mapping)', () => {
  it('parses a file whose columns are reordered and use recognized alias headers', () => {
    const csv = ['Serial Number,Dealer,Engine No,Customer,Phone,Delivery Date', 'SER-001,D1,ENG-1,John Doe,0812345678,2026-01-05'].join('\n');
    const buffer = Buffer.from(csv, 'utf-8');
    return parseNtrImportFile(buffer, 'legacy.csv').then((rows) => {
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        row: 2,
        serial: 'SER-001',
        dealer_id: 'D1',
        engine_number: 'ENG-1',
        customer_name: 'John Doe',
        customer_phone: '0812345678',
        delivery_date: '2026-01-05',
      });
    });
  });

  it('leaves an absent optional column as null rather than failing', () => {
    const csv = ['dealer_id,serial,engine_number,customer_name,customer_phone,delivery_date', 'D1,SER-002,ENG-2,Jane Doe,0899999999,2026-02-01'].join(
      '\n'
    );
    const buffer = Buffer.from(csv, 'utf-8');
    return parseNtrImportFile(buffer, 'legacy.csv').then((rows) => {
      expect(rows[0].model).toBeNull();
      expect(rows[0].hour_meter).toBeNull();
      expect(rows[0].manufacturing_year).toBeNull();
    });
  });

  it('coerces numeric fields via their declared parse function', () => {
    const csv = [
      'dealer_id,serial,engine_number,customer_name,customer_phone,delivery_date,hour_meter,manufacturing_year',
      'D1,SER-003,ENG-3,Jane Doe,0899999999,2026-02-01,120,2024',
    ].join('\n');
    const buffer = Buffer.from(csv, 'utf-8');
    return parseNtrImportFile(buffer, 'legacy.csv').then((rows) => {
      expect(rows[0].hour_meter).toBe(120);
      expect(rows[0].manufacturing_year).toBe(2024);
    });
  });
});

describe('mapNtrImportHeaders', () => {
  it('reports missing required columns for a file with none of the recognizable headers', () => {
    return mapNtrImportHeaders(Buffer.from('Foo,Bar,Baz\n1,2,3', 'utf-8'), 'wrong.csv').then((result) => {
      expect(result.mapped).toHaveLength(0);
      expect(result.missingRequiredColumns.length).toBeGreaterThan(0);
      expect(result.unknownColumns).toEqual(['Foo', 'Bar', 'Baz']);
    });
  });
});
