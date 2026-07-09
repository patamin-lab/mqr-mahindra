/**
 * Activity Timeline — Platform Standard (event model).
 *
 * The generic event shape every module's history/audit trail renders
 * through, via `<ActivityTimeline>` (see `ActivityTimeline.tsx`). Designed
 * once, reused everywhere - MQR (this PR), then PM/NTR/Warranty/ORC/Parts/
 * Campaign/Delivery/Vehicle Registration/Owner Transfer without a redesign
 * (see `docs/architecture/ACTIVITY_TIMELINE.md`).
 *
 * `entityType` deliberately reuses the existing `AuditModule` union
 * (`lib/types.ts`) rather than inventing a parallel one - `record_audit_log`
 * is already module-agnostic (`module: AuditModule`), so no new storage or
 * naming scheme was needed to make this generic (per the "reuse existing
 * audit infrastructure, avoid MQR-specific naming" requirement). Only the
 * *rendering* layer is new.
 */
import { AuditModule } from '@/lib/types';

/**
 * Every event type this timeline knows how to render. The audit-log-backed
 * types (everything except the last three) are what this PR actually
 * produces, mapped from `AuditLogEntry` (see `mapAuditLogToActivityEvents.ts`).
 * `CommentAdded`/`NoteAdded`/`Pinned` are rendering support prepared ahead of
 * the "v2.4.x - Collaboration Layer" follow-up (comments/internal notes/
 * pinning) - this timeline already knows their icon/filter/summary shape,
 * so that follow-up only has to *produce* events of these types, not
 * redesign the component that displays them.
 */
export type ActivityEventType =
  | 'Created'
  | 'FieldChanged'
  | 'StatusChanged'
  | 'SeverityChanged'
  | 'RcaUpdated'
  | 'AttachmentAdded'
  | 'AttachmentRemoved'
  | 'AssignmentChanged'
  | 'Locked'
  | 'Unlocked'
  | 'Deleted'
  | 'SystemEvent'
  /** Reserved - see the Collaboration Layer follow-up. Not produced by this PR. */
  | 'CommentAdded'
  /** Reserved - see the Collaboration Layer follow-up. Not produced by this PR. */
  | 'NoteAdded'
  /** Reserved - see the Collaboration Layer follow-up. Not produced by this PR. */
  | 'Pinned';

/** The filter categories from the spec - each maps to one or more
 *  `ActivityEventType`s (see `ACTIVITY_FILTER_EVENT_TYPES` below). */
export type ActivityFilter = 'all' | 'edits' | 'status' | 'photos' | 'comments' | 'assignments' | 'pinned';

export interface ActivityFieldChange {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
}

export interface ActivityPhotoChange {
  label: string;
  url: string;
  action: 'added' | 'removed';
}

/** Optional cross-references a timeline event may carry - lets a future
 *  Vehicle 360 aggregation render "this event also touched the Warranty
 *  record" without the timeline component itself knowing what Warranty is. */
export interface ActivityRelatedObjects {
  vehicleSerial?: string | null;
  customerName?: string | null;
  dealerId?: string | null;
  technicianId?: string | null;
  reportRef?: string | null;
  pmRef?: string | null;
  orcRef?: string | null;
  warrantyRef?: string | null;
}

/** Which on-page section a click on this event should scroll to - the
 *  timeline component never knows real DOM ids (a page-specific detail);
 *  it only emits this generic key via `onNavigate`, and the page decides
 *  what element (if any) that maps to. `null`/omitted = not clickable. */
export type ActivityNavigationTarget = 'status' | 'photos' | 'warranty' | 'rca' | null;

export interface ActivityEvent {
  eventId: string;
  eventType: ActivityEventType;
  /** Reuses `AuditModule` - see this file's top doc comment. */
  entityType: AuditModule;
  entityId: string;
  /** Human-readable reference for display (e.g. job_id/pm_number) - not
   *  used for lookups. */
  entityRef: string;
  vehicleSerial: string | null;
  user: { username: string; fullName?: string | null };
  /** ISO timestamp. */
  timestamp: string;
  /** One-line summary, e.g. "4 fields changed" / "Open → Investigating". */
  summary: string;
  /** Populated for edit-style events; `null` for events with nothing to diff. */
  changes: ActivityFieldChange[] | null;
  /** Populated only when photos were added/removed in this event. */
  photoChanges: ActivityPhotoChange[] | null;
  /** Free-form, forward-compatible bag - e.g. a future cached AI summary
   *  (`metadata.aiSummary`), or a mention list once Collaboration Layer
   *  events start appearing here. Never read by the timeline component
   *  itself today; exists so new producers don't need a schema change to
   *  attach event-specific extras. */
  metadata: Record<string, unknown>;
  /** Always `false` until the Collaboration Layer follow-up ships a real
   *  pin mechanism - present now so the UI/filter never needs a shape
   *  change when it does. */
  pinned: boolean;
  relatedObjects?: ActivityRelatedObjects;
  navigationTarget?: ActivityNavigationTarget;
}

/** Which `ActivityEventType`s each filter chip includes. `'pinned'` isn't
 *  type-based (it's the `pinned` flag) - handled separately by the
 *  component. */
export const ACTIVITY_FILTER_EVENT_TYPES: Record<Exclude<ActivityFilter, 'all' | 'pinned'>, ActivityEventType[]> = {
  edits: ['FieldChanged', 'RcaUpdated', 'SeverityChanged'],
  status: ['StatusChanged', 'Locked', 'Unlocked'],
  photos: ['AttachmentAdded', 'AttachmentRemoved'],
  comments: ['CommentAdded', 'NoteAdded'],
  assignments: ['AssignmentChanged'],
};
