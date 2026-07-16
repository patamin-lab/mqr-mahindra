'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ActivityEvent } from './types';
import { getActivityIcon, getActivityActionLabel } from './activityLabels';
import DiffViewer from './DiffViewer';
import PhotoDiff from './PhotoDiff';

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface ActivityEventRowProps {
  event: ActivityEvent;
  entityLabel: string;
  t: Translate;
  formattedDate: string;
  /** Quick Navigation - omitted (no button rendered) when the event has no
   *  `navigationTarget`, or the page didn't wire one up. */
  onNavigate?: (target: NonNullable<ActivityEvent['navigationTarget']>) => void;
  /** See `ActivityTimelineProps.getEntityHref` - renders a "→ {ref}" link to
   *  the record this event is about when provided and it resolves to a URL. */
  getEntityHref?: (event: ActivityEvent) => string | null | undefined;
}

export default function ActivityEventRow({ event, entityLabel, t, formattedDate, onNavigate, getEntityHref }: ActivityEventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = (event.changes?.length ?? 0) > 0 || (event.photoChanges?.length ?? 0) > 0;
  const entityHref = getEntityHref?.(event) ?? null;

  return (
    <li className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <div className="flex items-start gap-2 flex-wrap justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <span className="text-lg leading-none shrink-0" aria-hidden>
            {getActivityIcon(event)}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="font-medium text-brand-dark text-sm">{getActivityActionLabel(t, event, entityLabel)}</span>
              {event.pinned && <span className="text-xs text-amber-600">📌</span>}
              {event.navigationTarget && onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate(event.navigationTarget!)}
                  className="text-xs text-brand-red hover:underline"
                >
                  {'→'}
                </button>
              )}
            </div>
            <div className="text-xs text-gray-500">
              {event.user.fullName ?? event.user.username} · {formattedDate}
            </div>
            <div className="text-sm text-gray-700 mt-0.5 break-words">{event.summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {entityHref && (
            <Link href={entityHref} className="text-xs text-brand-red hover:underline whitespace-nowrap">
              {event.entityRef} →
            </Link>
          )}
          {hasDetail && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-brand-red hover:underline whitespace-nowrap"
            >
              {expanded ? t('activityTimeline.hideChanges') : t('activityTimeline.viewChanges')}
            </button>
          )}
        </div>
      </div>
      {expanded && hasDetail && (
        <div className="mt-3 ml-7 space-y-3">
          {event.changes && event.changes.length > 0 && <DiffViewer changes={event.changes} />}
          {event.photoChanges && event.photoChanges.length > 0 && (
            <PhotoDiff
              photoChanges={event.photoChanges}
              removedLabel={t('activityTimeline.removedPhotos')}
              addedLabel={t('activityTimeline.addedPhotos')}
            />
          )}
        </div>
      )}
    </li>
  );
}
