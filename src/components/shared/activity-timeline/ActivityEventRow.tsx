'use client';

import { useState } from 'react';
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
}

export default function ActivityEventRow({ event, entityLabel, t, formattedDate, onNavigate }: ActivityEventRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = (event.changes?.length ?? 0) > 0 || (event.photoChanges?.length ?? 0) > 0;

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
        {hasDetail && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-brand-red hover:underline shrink-0"
          >
            {expanded ? t('activityTimeline.hideChanges') : t('activityTimeline.viewChanges')}
          </button>
        )}
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
