import { describe, it, expect } from 'vitest';
import { ActivityEvent } from '../types';
import { getActivityIcon, getActivityActionLabel, matchesFilter, matchesSearch } from '../activityLabels';

function baseEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    eventId: 'e1',
    eventType: 'FieldChanged',
    entityType: 'mqr',
    entityId: 'r1',
    entityRef: 'MQR-KTV-2026-000001',
    vehicleSerial: 'S1',
    user: { username: 'alice' },
    timestamp: '2026-07-01T00:00:00.000Z',
    summary: '2 fields changed',
    changes: [{ fieldName: 'ชื่อลูกค้า', oldValue: 'A', newValue: 'B' }],
    photoChanges: null,
    metadata: {},
    pinned: false,
    ...overrides,
  };
}

const t = (key: string, vars?: Record<string, string | number>) => (vars ? `${key}:${JSON.stringify(vars)}` : key);

describe('getActivityIcon', () => {
  it('returns the created icon', () => {
    expect(getActivityIcon(baseEvent({ eventType: 'Created' }))).toBe('🟢');
  });
  it('returns the edited icon for FieldChanged/RcaUpdated', () => {
    expect(getActivityIcon(baseEvent({ eventType: 'FieldChanged' }))).toBe('✏️');
    expect(getActivityIcon(baseEvent({ eventType: 'RcaUpdated' }))).toBe('✏️');
  });
  it('returns the closed icon when a StatusChanged event is marked isClosing', () => {
    expect(getActivityIcon(baseEvent({ eventType: 'StatusChanged', metadata: { isClosing: true } }))).toBe('✅');
  });
  it('returns the reopened icon when a StatusChanged event is marked isReopening', () => {
    expect(getActivityIcon(baseEvent({ eventType: 'StatusChanged', metadata: { isReopening: true } }))).toBe('↩');
  });
  it('returns the generic status-changed icon otherwise', () => {
    expect(getActivityIcon(baseEvent({ eventType: 'StatusChanged', metadata: {} }))).toBe('🔄');
  });
  it('returns the photo icon for AttachmentAdded/Removed', () => {
    expect(getActivityIcon(baseEvent({ eventType: 'AttachmentAdded' }))).toBe('📷');
    expect(getActivityIcon(baseEvent({ eventType: 'AttachmentRemoved' }))).toBe('📷');
  });
});

describe('getActivityActionLabel', () => {
  it('substitutes the entity label into the Created/Edited/Deleted templates', () => {
    expect(getActivityActionLabel(t, baseEvent({ eventType: 'Created' }), 'Report')).toContain('"entity":"Report"');
    expect(getActivityActionLabel(t, baseEvent({ eventType: 'Deleted' }), 'Report')).toContain('"entity":"Report"');
  });
  it('does not require an entity label for status/severity/photo events', () => {
    expect(getActivityActionLabel(t, baseEvent({ eventType: 'StatusChanged', metadata: {} }), 'Report')).toBe('activityTimeline.actionStatusChanged');
  });
});

describe('matchesFilter', () => {
  it('"all" matches every event', () => {
    expect(matchesFilter(baseEvent({ eventType: 'Created' }), 'all')).toBe(true);
  });
  it('"edits" matches FieldChanged/RcaUpdated/SeverityChanged only', () => {
    expect(matchesFilter(baseEvent({ eventType: 'FieldChanged' }), 'edits')).toBe(true);
    expect(matchesFilter(baseEvent({ eventType: 'StatusChanged' }), 'edits')).toBe(false);
  });
  it('"photos" matches AttachmentAdded/Removed only', () => {
    expect(matchesFilter(baseEvent({ eventType: 'AttachmentAdded' }), 'photos')).toBe(true);
    expect(matchesFilter(baseEvent({ eventType: 'Created' }), 'photos')).toBe(false);
  });
  it('"pinned" matches by the pinned flag, not event type', () => {
    expect(matchesFilter(baseEvent({ eventType: 'Created', pinned: true }), 'pinned')).toBe(true);
    expect(matchesFilter(baseEvent({ eventType: 'Created', pinned: false }), 'pinned')).toBe(false);
  });
});

describe('matchesSearch', () => {
  it('an empty query matches everything', () => {
    expect(matchesSearch(baseEvent(), '')).toBe(true);
  });
  it('matches against the summary, case-insensitively', () => {
    expect(matchesSearch(baseEvent({ summary: 'Battery replaced' }), 'battery')).toBe(true);
    expect(matchesSearch(baseEvent({ summary: 'Battery replaced' }), 'alternator')).toBe(false);
  });
  it('matches against changed field values', () => {
    const event = baseEvent({ changes: [{ fieldName: 'Symptom', oldValue: 'Battery', newValue: 'Alternator' }] });
    expect(matchesSearch(event, 'alternator')).toBe(true);
  });
  it('matches against the user', () => {
    expect(matchesSearch(baseEvent({ user: { username: 'bob', fullName: 'Bob Smith' } }), 'bob smith')).toBe(true);
  });
});
