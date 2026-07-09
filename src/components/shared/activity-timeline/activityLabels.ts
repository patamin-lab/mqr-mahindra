/**
 * Presentation-only helpers for `<ActivityTimeline>` - icon/action-label/
 * filter-matching. Kept separate from `mapAuditLogToActivityEvents.ts` (data
 * shaping) so a future event producer (Collaboration Layer, PM, Warranty...)
 * only needs to emit the right `ActivityEventType`/`metadata` shape to get
 * correct rendering here, never touch this file.
 */
import { ActivityEvent, ActivityFilter, ACTIVITY_FILTER_EVENT_TYPES } from './types';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function getActivityIcon(event: ActivityEvent): string {
  switch (event.eventType) {
    case 'Created':
      return '🟢';
    case 'FieldChanged':
    case 'RcaUpdated':
      return '✏️';
    case 'StatusChanged':
      if (event.metadata.isClosing) return '✅';
      if (event.metadata.isReopening) return '↩';
      return '🔄';
    case 'SeverityChanged':
      return '🔄';
    case 'AttachmentAdded':
    case 'AttachmentRemoved':
      return '📷';
    case 'CommentAdded':
      return '💬';
    case 'NoteAdded':
      return '📝';
    case 'AssignmentChanged':
      return '👤';
    case 'Locked':
      return '🔒';
    case 'Unlocked':
      return '🔓';
    case 'Deleted':
      return '🗑️';
    case 'Pinned':
      return '📌';
    case 'SystemEvent':
    default:
      return '•';
  }
}

/** `entityLabel` is the human noun for this module's record ("Report" for
 *  MQR today) - substituted into the generic "{entity} Created"/"{entity}
 *  Edited"/"{entity} Deleted" templates so the same translation keys serve
 *  every future module without redefining them per module. */
export function getActivityActionLabel(t: Translate, event: ActivityEvent, entityLabel: string): string {
  switch (event.eventType) {
    case 'Created':
      return t('activityTimeline.actionCreated', { entity: entityLabel });
    case 'FieldChanged':
    case 'RcaUpdated':
      return t('activityTimeline.actionEdited', { entity: entityLabel });
    case 'StatusChanged':
      if (event.metadata.isClosing) return t('activityTimeline.actionClosed');
      if (event.metadata.isReopening) return t('activityTimeline.actionReopened');
      return t('activityTimeline.actionStatusChanged');
    case 'SeverityChanged':
      return t('activityTimeline.actionSeverityChanged');
    case 'AttachmentAdded':
    case 'AttachmentRemoved':
      return t('activityTimeline.actionPhotosUpdated');
    case 'CommentAdded':
      return t('activityTimeline.actionCommentAdded');
    case 'NoteAdded':
      return t('activityTimeline.actionNoteAdded');
    case 'AssignmentChanged':
      return t('activityTimeline.actionAssigned');
    case 'Locked':
      return t('activityTimeline.actionLocked');
    case 'Unlocked':
      return t('activityTimeline.actionUnlocked');
    case 'Deleted':
      return t('activityTimeline.actionDeleted', { entity: entityLabel });
    case 'Pinned':
      return t('activityTimeline.actionPinned');
    case 'SystemEvent':
    default:
      return event.eventType;
  }
}

export function matchesFilter(event: ActivityEvent, filter: ActivityFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'pinned') return event.pinned;
  return ACTIVITY_FILTER_EVENT_TYPES[filter].includes(event.eventType);
}

export function matchesSearch(event: ActivityEvent, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    event.summary,
    event.user.fullName ?? '',
    event.user.username,
    ...(event.changes ?? []).flatMap((c) => [c.fieldName, c.oldValue ?? '', c.newValue ?? '']),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}
