import { describe, it, expect } from 'vitest';
import { buildCsv, buildRecordsCsv } from '../exportCsv';
import type { MqrRecord } from '../types';

describe('buildCsv', () => {
  it('prefixes the output with a UTF-8 BOM', () => {
    const buf = buildCsv([{ a: 1 }], [{ header: 'A', value: (r: { a: number }) => r.a }]);
    expect(buf.toString('utf8').charCodeAt(0)).toBe(0xfeff);
  });

  it('joins rows with CRLF and quotes fields containing a comma', () => {
    const buf = buildCsv(
      [{ name: 'Somchai, Jr.', note: 'ok' }],
      [
        { header: 'Name', value: (r) => r.name },
        { header: 'Note', value: (r) => r.note },
      ]
    );
    const text = buf.toString('utf8').replace(/^﻿/, '');
    expect(text).toBe('Name,Note\r\n"Somchai, Jr.",ok');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const buf = buildCsv([{ v: 'say "hi"' }], [{ header: 'V', value: (r) => r.v }]);
    const text = buf.toString('utf8').replace(/^﻿/, '');
    expect(text).toBe('V\r\n"say ""hi"""');
  });

  it('renders null/undefined values as an empty cell, not the literal string "null"', () => {
    const buf = buildCsv([{ v: null }], [{ header: 'V', value: (r) => r.v as null }]);
    const text = buf.toString('utf8').replace(/^﻿/, '');
    expect(text).toBe('V\r\n');
  });
});

describe('buildRecordsCsv', () => {
  it('produces one data row per record with the job_id as the first column', () => {
    const record = { job_id: 'QIR-2607-0001', found_date: '2026-07-01' } as unknown as MqrRecord;
    const buf = buildRecordsCsv([record]);
    const text = buf.toString('utf8').replace(/^﻿/, '');
    const lines = text.split('\r\n');
    expect(lines[1].startsWith('QIR-2607-0001,')).toBe(true);
  });
});
