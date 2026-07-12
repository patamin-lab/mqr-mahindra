import { describe, it, expect } from 'vitest';
import { AuditLogEntry } from '@/lib/types';
import { mapAuditLogToActivityEvents, mapMixedAuditLogToActivityEvents } from '../mapAuditLogToActivityEvents';

const context = {
  entityType: 'mqr' as const,
  entityId: 'r1',
  entityRef: 'MQR-KTV-2026-000001',
  vehicleSerial: 'S1',
  closingStatusValues: ['Repaired', 'Closed'],
};

function entry(overrides: Partial<AuditLogEntry>): AuditLogEntry {
  return {
    id: `e${Math.random()}`,
    module: 'mqr',
    recordId: 'r1',
    recordRef: 'MQR-KTV-2026-000001',
    eventType: 'FieldChanged',
    fieldName: null,
    oldValue: null,
    newValue: null,
    performedBy: 'alice',
    performedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('mapAuditLogToActivityEvents', () => {
  it('maps a Created row to a Created event with no changes', () => {
    const events = mapAuditLogToActivityEvents([entry({ eventType: 'Created', performedAt: '2026-07-01T00:00:00.000Z' })], context);
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('Created');
    expect(events[0].changes).toBeNull();
    expect(events[0].photoChanges).toBeNull();
  });

  it('maps a standalone StatusChanged row to a StatusChanged event with an old→new summary', () => {
    const events = mapAuditLogToActivityEvents(
      [entry({ eventType: 'StatusChanged', oldValue: 'Open', newValue: 'UnderInvestigation', performedAt: '2026-07-01T00:00:00.000Z' })],
      context
    );
    expect(events[0].eventType).toBe('StatusChanged');
    expect(events[0].summary).toBe('Open → UnderInvestigation');
    expect(events[0].navigationTarget).toBe('status');
    expect(events[0].metadata.isClosing).toBe(false);
    expect(events[0].metadata.isReopening).toBe(false);
  });

  it('marks a StatusChanged event isClosing when the new status is in closingStatusValues', () => {
    const events = mapAuditLogToActivityEvents(
      [entry({ eventType: 'StatusChanged', oldValue: 'Open', newValue: 'Closed', performedAt: '2026-07-01T00:00:00.000Z' })],
      context
    );
    expect(events[0].metadata.isClosing).toBe(true);
    expect(events[0].metadata.isReopening).toBe(false);
  });

  it('marks a StatusChanged event isReopening when the old status was closing and the new one is not', () => {
    const events = mapAuditLogToActivityEvents(
      [entry({ eventType: 'StatusChanged', oldValue: 'Closed', newValue: 'Open', performedAt: '2026-07-01T00:00:00.000Z' })],
      context
    );
    expect(events[0].metadata.isReopening).toBe(true);
    expect(events[0].metadata.isClosing).toBe(false);
  });

  it('groups multiple RcaUpdated/FieldChanged rows sharing the same timestamp into one "N fields changed" event', () => {
    const ts = '2026-07-02T10:00:00.000Z';
    const events = mapAuditLogToActivityEvents(
      [
        entry({ eventType: 'RcaUpdated', fieldName: 'สาเหตุ', oldValue: 'A', newValue: 'B', performedAt: ts }),
        entry({ eventType: 'RcaUpdated', fieldName: 'ชิ้นส่วนที่เสียหาย', oldValue: 'C', newValue: 'D', performedAt: ts }),
      ],
      context
    );
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('FieldChanged');
    expect(events[0].summary).toBe('2 fields changed');
    expect(events[0].changes).toHaveLength(2);
  });

  it('groups AttachmentAdded/AttachmentRemoved rows sharing the same timestamp into one photo event', () => {
    const ts = '2026-07-03T10:00:00.000Z';
    const events = mapAuditLogToActivityEvents(
      [
        entry({ eventType: 'AttachmentRemoved', oldValue: 'https://old.example/odometer.jpg', performedAt: ts }),
        entry({ eventType: 'AttachmentAdded', fieldName: 'รูปเรือนไมล์', newValue: 'https://new.example/odometer.jpg', performedAt: ts }),
      ],
      context
    );
    expect(events).toHaveLength(1);
    expect(events[0].photoChanges).toHaveLength(2);
    expect(events[0].photoChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: 'removed', url: 'https://old.example/odometer.jpg' }),
        expect.objectContaining({ action: 'added', url: 'https://new.example/odometer.jpg' }),
      ])
    );
    expect(events[0].navigationTarget).toBe('photos');
    expect(events[0].summary).toBe('2 photos updated');
  });

  it('carries both changes and photoChanges when one save edits fields and replaces a photo', () => {
    const ts = '2026-07-04T10:00:00.000Z';
    const events = mapAuditLogToActivityEvents(
      [
        entry({ eventType: 'FieldChanged', fieldName: 'ชื่อลูกค้า', oldValue: 'A', newValue: 'B', performedAt: ts }),
        entry({ eventType: 'AttachmentAdded', fieldName: 'รูปเลขรถ', newValue: 'https://new.example/serial.jpg', performedAt: ts }),
      ],
      context
    );
    expect(events).toHaveLength(1);
    expect(events[0].changes).toHaveLength(1);
    expect(events[0].photoChanges).toHaveLength(1);
  });

  it('separates events with different timestamps into distinct events, newest first', () => {
    const events = mapAuditLogToActivityEvents(
      [
        entry({ eventType: 'Created', performedAt: '2026-07-01T00:00:00.000Z' }),
        entry({ eventType: 'StatusChanged', oldValue: 'Open', newValue: 'Closed', performedAt: '2026-07-05T00:00:00.000Z' }),
      ],
      context
    );
    expect(events).toHaveLength(2);
    expect(events[0].timestamp).toBe('2026-07-05T00:00:00.000Z');
    expect(events[1].timestamp).toBe('2026-07-01T00:00:00.000Z');
  });

  it('every event carries the given entity context', () => {
    const events = mapAuditLogToActivityEvents([entry({ eventType: 'Created' })], context);
    expect(events[0].entityType).toBe('mqr');
    expect(events[0].entityId).toBe('r1');
    expect(events[0].entityRef).toBe('MQR-KTV-2026-000001');
    expect(events[0].vehicleSerial).toBe('S1');
    expect(events[0].pinned).toBe(false);
  });
});

describe('mapMixedAuditLogToActivityEvents (Platform Overview "Today\'s Activities", ADR-023 refinement)', () => {
  it('groups rows by module+recordId (not just timestamp) so two different records never merge into one event', () => {
    const ts = '2026-07-09T09:00:00.000Z';
    const events = mapMixedAuditLogToActivityEvents([
      entry({ module: 'mqr', recordId: 'r1', recordRef: 'MQR-KTV-2026-000001', eventType: 'Created', performedAt: ts }),
      entry({ module: 'pm', recordId: 'r2', recordRef: 'PM-KTV-2026-000001', eventType: 'Created', performedAt: ts }),
    ]);
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.entityId).sort()).toEqual(['r1', 'r2']);
    expect(events.find((e) => e.entityId === 'r1')?.entityType).toBe('mqr');
    expect(events.find((e) => e.entityId === 'r2')?.entityType).toBe('pm');
  });

  it('still collapses same-timestamp rows for the same record into one event (reuses the single-record rule)', () => {
    const ts = '2026-07-09T09:00:00.000Z';
    const events = mapMixedAuditLogToActivityEvents([
      entry({ module: 'ntr', recordId: 'r3', recordRef: 'NTR-KTV-2026-000001', eventType: 'RcaUpdated', fieldName: 'a', oldValue: '1', newValue: '2', performedAt: ts }),
      entry({ module: 'ntr', recordId: 'r3', recordRef: 'NTR-KTV-2026-000001', eventType: 'RcaUpdated', fieldName: 'b', oldValue: '3', newValue: '4', performedAt: ts }),
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].changes).toHaveLength(2);
  });

  it('sorts the merged, cross-record result newest first', () => {
    const events = mapMixedAuditLogToActivityEvents([
      entry({ module: 'mqr', recordId: 'r1', recordRef: 'MQR-KTV-2026-000001', eventType: 'Created', performedAt: '2026-07-01T00:00:00.000Z' }),
      entry({ module: 'pm', recordId: 'r2', recordRef: 'PM-KTV-2026-000001', eventType: 'Created', performedAt: '2026-07-05T00:00:00.000Z' }),
    ]);
    expect(events[0].timestamp).toBe('2026-07-05T00:00:00.000Z');
    expect(events[1].timestamp).toBe('2026-07-01T00:00:00.000Z');
  });

  it('returns an empty array for no entries, never throws', () => {
    expect(mapMixedAuditLogToActivityEvents([])).toEqual([]);
  });
});
