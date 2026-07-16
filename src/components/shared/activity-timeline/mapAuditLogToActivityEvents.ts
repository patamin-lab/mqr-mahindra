/**
 * Adapter: `AuditLogEntry[]` (the existing, shared `record_audit_log` -
 * already module-agnostic across MQR/PM/NTR) → `ActivityEvent[]` (the
 * generic timeline shape). This is the *only* new "storage" this feature
 * touches - it reads the existing audit log, nothing is duplicated or
 * additionally persisted. See `docs/architecture/ACTIVITY_TIMELINE.md`.
 */
import { AuditLogEntry, AuditModule } from '@/lib/types';
import { ActivityEvent, ActivityFieldChange, ActivityPhotoChange, ActivityNavigationTarget } from './types';

export interface ActivityContext {
  entityType: AuditModule;
  entityId: string;
  entityRef: string;
  vehicleSerial: string | null;
  /** Status values this module considers "closing" (e.g. MQR's
   *  Repaired/Closed) - lets a StatusChanged event render as ✅ Closed /
   *  ↩ Reopened instead of the generic 🔄, without the adapter itself
   *  knowing any module's specific status vocabulary. Omit for a module
   *  with no closing concept (e.g. one still being onboarded) - falls
   *  back to the generic status-changed rendering. */
  closingStatusValues?: string[];
}

/** One `updateRecord()`/`createRecord()` call writes every one of its audit
 *  rows with the identical `new Date().toISOString()` value (computed once
 *  per request, before any DB write) - grouping by that exact string is a
 *  reliable, zero-schema-change way to reassemble "everything one save
 *  actually changed" into a single timeline event, matching the "Report
 *  Edited: 4 fields changed" / "Photos Updated" grouping the design calls
 *  for. A batch that mixes field changes and photo changes (e.g. an Edit
 *  Report save that also replaces a photo) becomes one event carrying both
 *  `changes` and `photoChanges`. */
export function mapAuditLogToActivityEvents(entries: AuditLogEntry[], context: ActivityContext): ActivityEvent[] {
  const groups = new Map<string, AuditLogEntry[]>();
  for (const entry of entries) {
    const key = entry.performedAt;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }

  const events: ActivityEvent[] = [];
  for (const [timestamp, group] of groups) {
    events.push(buildEvent(group, timestamp, context));
  }

  // Groups iterate in Map insertion order (== the entries' own order, which
  // `listAuditLog()` already fetches newest-first) - re-sort defensively
  // rather than relying on insertion order alone, since a caller could pass
  // entries in any order.
  events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
  return events;
}

function buildEvent(group: AuditLogEntry[], timestamp: string, context: ActivityContext): ActivityEvent {
  const first = group[0];
  const eventId = group.map((e) => e.id).join(',');
  const user = { username: first.performedBy };

  if (group.some((e) => e.eventType === 'Created')) {
    return {
      eventId,
      eventType: 'Created',
      entityType: context.entityType,
      entityId: context.entityId,
      entityRef: context.entityRef,
      vehicleSerial: context.vehicleSerial,
      user,
      timestamp,
      summary: context.entityRef,
      changes: null,
      photoChanges: null,
      metadata: {},
      pinned: false,
      navigationTarget: null,
    };
  }

  if (group.some((e) => e.eventType === 'Deleted')) {
    return {
      eventId,
      eventType: 'Deleted',
      entityType: context.entityType,
      entityId: context.entityId,
      entityRef: context.entityRef,
      vehicleSerial: context.vehicleSerial,
      user,
      timestamp,
      summary: context.entityRef,
      changes: null,
      photoChanges: null,
      metadata: {},
      pinned: false,
      navigationTarget: null,
    };
  }

  const photoRows = group.filter((e) => e.eventType === 'AttachmentAdded' || e.eventType === 'AttachmentRemoved');
  const fieldRows = group.filter(
    (e) => e.eventType === 'FieldChanged' || e.eventType === 'RcaUpdated' || e.eventType === 'SeverityChanged' || e.eventType === 'StatusChanged'
  );

  const photoChanges: ActivityPhotoChange[] | null =
    photoRows.length > 0
      ? photoRows.map((e) => ({
          label: e.eventType === 'AttachmentAdded' ? e.fieldName ?? 'Photo' : e.fieldName ?? 'Photo',
          url: e.eventType === 'AttachmentAdded' ? e.newValue ?? '' : e.oldValue ?? '',
          action: e.eventType === 'AttachmentAdded' ? 'added' : 'removed',
        }))
      : null;

  const changes: ActivityFieldChange[] | null =
    fieldRows.length > 0
      ? fieldRows.map((e) => ({
          fieldName: e.eventType === 'StatusChanged' ? 'Status' : e.eventType === 'SeverityChanged' ? 'Severity' : e.fieldName ?? '',
          oldValue: e.oldValue,
          newValue: e.newValue,
        }))
      : null;

  // Standalone status change (no field/photo changes alongside it) - its
  // own event type/summary/icon, matching the spec's explicit
  // "🔄 Status Changed" / "✅ Closed" / "↩ Reopened" examples.
  const onlyStatusChanged = group.length === 1 && group[0].eventType === 'StatusChanged';
  if (onlyStatusChanged) {
    const e = group[0];
    const closingValues = new Set(context.closingStatusValues ?? []);
    const isClosing = !!e.newValue && closingValues.has(e.newValue);
    const isReopening = !!e.oldValue && closingValues.has(e.oldValue) && !isClosing;
    return {
      eventId,
      eventType: 'StatusChanged',
      entityType: context.entityType,
      entityId: context.entityId,
      entityRef: context.entityRef,
      vehicleSerial: context.vehicleSerial,
      user,
      timestamp,
      summary: `${e.oldValue ?? '-'} → ${e.newValue ?? '-'}`,
      changes: [{ fieldName: 'Status', oldValue: e.oldValue, newValue: e.newValue }],
      photoChanges: null,
      metadata: { isClosing, isReopening },
      pinned: false,
      navigationTarget: 'status',
    };
  }

  if (photoRows.length > 0 && fieldRows.length === 0) {
    return {
      eventId,
      eventType: 'AttachmentAdded',
      entityType: context.entityType,
      entityId: context.entityId,
      entityRef: context.entityRef,
      vehicleSerial: context.vehicleSerial,
      user,
      timestamp,
      summary: photoCountSummary(photoChanges),
      changes: null,
      photoChanges,
      metadata: {},
      pinned: false,
      navigationTarget: 'photos',
    };
  }

  // Mixed or multi-field edit - "Report Edited" / "N fields changed",
  // matching the design's collapsed-state example exactly. May also carry
  // photoChanges if the same save replaced a photo.
  const navigationTarget: ActivityNavigationTarget = fieldRows.some((e) => e.eventType === 'StatusChanged') ? 'status' : 'rca';
  return {
    eventId,
    eventType: 'FieldChanged',
    entityType: context.entityType,
    entityId: context.entityId,
    entityRef: context.entityRef,
    vehicleSerial: context.vehicleSerial,
    user,
    timestamp,
    summary: changes ? `${changes.length} field${changes.length === 1 ? '' : 's'} changed` : photoCountSummary(photoChanges),
    changes,
    photoChanges,
    metadata: {},
    pinned: false,
    navigationTarget,
  };
}

function photoCountSummary(photoChanges: ActivityPhotoChange[] | null): string {
  const n = photoChanges?.length ?? 0;
  return `${n} photo${n === 1 ? '' : 's'} updated`;
}

/**
 * Maps an event's `entityType`/`entityId`/`entityRef` to its module's real
 * detail-page URL, so a cross-module feed (Platform Overview's "Today's
 * Activities") can link a timeline entry back to the record it's actually
 * about, instead of being a dead end - see `ActivityTimeline`'s optional
 * `getEntityHref` prop. `mqr`'s route is keyed by `job_id` (`entityRef`),
 * every other module's route is keyed by its real id (`entityId`) - matches
 * each module's own `[id]`/`[jobId]` page today.
 */
export function getActivityEntityHref(event: Pick<ActivityEvent, 'entityType' | 'entityId' | 'entityRef'>): string | null {
  switch (event.entityType) {
    case 'mqr':
      return `/records/${encodeURIComponent(event.entityRef)}`;
    case 'pm':
      return `/pm-records/${encodeURIComponent(event.entityId)}`;
    case 'ntr':
      return `/ntr/${encodeURIComponent(event.entityId)}`;
    case 'knowledge':
      return `/quality/knowledge/${encodeURIComponent(event.entityId)}`;
    case 'pdi':
      return `/delivery/pdi/${encodeURIComponent(event.entityId)}`;
    case 'delivery':
      return `/delivery/records/${encodeURIComponent(event.entityId)}`;
  }
}

/**
 * Cross-record variant for a mixed, multi-module feed (MSEAL Design
 * Framework, ADR-023 refinement - Platform Overview's "Today's Activities"
 * widget). Each `AuditLogEntry` already carries its own `module`/`recordId`/
 * `recordRef` (see `AuditLogEntry`), so - unlike the single-record
 * `mapAuditLogToActivityEvents()` above - no external `ActivityContext` is
 * needed; this groups entries into per-record batches first (the same
 * "one save = one event" collapsing rule), maps each batch through the
 * existing single-record function, then merges and re-sorts by timestamp.
 * `vehicleSerial`/`closingStatusValues` aren't known across arbitrary
 * records here, so a status change renders with the generic 🔄 icon rather
 * than a module-aware ✅/↩ - an acceptable, honest limitation for a
 * cross-module summary feed (a single record's own timeline still gets the
 * richer rendering via the function above).
 */
export function mapMixedAuditLogToActivityEvents(entries: AuditLogEntry[]): ActivityEvent[] {
  const byRecord = new Map<string, AuditLogEntry[]>();
  for (const entry of entries) {
    const key = `${entry.module}:${entry.recordId}`;
    if (!byRecord.has(key)) byRecord.set(key, []);
    byRecord.get(key)!.push(entry);
  }

  const events: ActivityEvent[] = [];
  for (const rows of byRecord.values()) {
    events.push(
      ...mapAuditLogToActivityEvents(rows, {
        entityType: rows[0].module,
        entityId: rows[0].recordId,
        entityRef: rows[0].recordRef,
        vehicleSerial: null,
      })
    );
  }

  events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : a.timestamp > b.timestamp ? -1 : 0));
  return events;
}
