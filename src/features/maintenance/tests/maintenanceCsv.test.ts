import { describe, it, expect } from 'vitest';
import { buildMaintenanceRecordsCsv } from '../services/maintenanceCsv';
import type { MaintenanceRecord } from '../types';

function makeRecord(overrides: Partial<MaintenanceRecord> = {}): MaintenanceRecord {
  return {
    id: 'rec-1',
    dealer_id: 'D1',
    branch_id: null,
    serial: 'SN-1',
    model: 'Model X',
    delivery_date: null,
    engine_number: null,
    customer_name: 'Somchai',
    customer_phone: '081-2345678',
    technician_id: null,
    technician_name: 'ช่างสมชาย',
    branch_name: 'สาขา A',
    scheduled_date: null,
    performed_date: '2026-01-01',
    hour_meter: 100,
    pm_interval_id: null,
    pm_number: 'PM-D1-2026-000001',
    next_pm_due: '2026-07-01',
    meter_photo_url: null,
    nameplate_photo_url: null,
    report_photo_url: null,
    meter_photo_attachment_id: null,
    nameplate_photo_attachment_id: null,
    report_photo_attachment_id: null,
    latitude: null,
    longitude: null,
    gps_accuracy: null,
    google_maps_url: null,
    status: 'Completed',
    notes: null,
    created_by: 'alice',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_by: 'alice',
    updated_at: '2026-01-01T00:00:00.000Z',
    locked_at: null,
    locked_reason: null,
    unlocked_until: null,
    unlocked_by: null,
    unlock_reason: null,
    deleted_reason: null,
    ...overrides,
  };
}

describe('buildMaintenanceRecordsCsv', () => {
  it('prefixes with a UTF-8 BOM and includes a header row', () => {
    const buf = buildMaintenanceRecordsCsv([makeRecord()]);
    const text = buf.toString('utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('เลขที่ PM');
  });

  it('includes the pm_number as the first column value for a data row', () => {
    const buf = buildMaintenanceRecordsCsv([makeRecord({ pm_number: 'PM-D1-2026-000042' })]);
    const text = buf.toString('utf8').replace(/^﻿/, '');
    const lines = text.split('\r\n');
    expect(lines[1].startsWith('PM-D1-2026-000042,')).toBe(true);
  });

  it('produces one data row per record', () => {
    const buf = buildMaintenanceRecordsCsv([makeRecord({ id: 'r1' }), makeRecord({ id: 'r2', pm_number: 'PM-2' })]);
    const text = buf.toString('utf8').replace(/^﻿/, '');
    const lines = text.split('\r\n').filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 rows
  });
});
