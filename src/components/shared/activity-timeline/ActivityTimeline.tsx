'use client';

/**
 * ActivityTimeline — Platform Standard.
 *
 * The one reusable timeline every module renders its activity history
 * through - MQR first (`records/[jobId]/page.tsx`), then PM/NTR/Warranty/
 * ORC/Parts/Campaign/Delivery/Vehicle Registration/Owner Transfer without a
 * redesign (see `docs/architecture/ACTIVITY_TIMELINE.md`). Takes only the
 * generic `ActivityEvent[]` shape (`types.ts`) - it has no idea what MQR,
 * PM, or a "report" is; a caller's adapter (`mapAuditLogToActivityEvents.ts`
 * today) does that translation.
 *
 * No new dependency: pagination ("Load more" after `pageSize`) is a plain
 * array slice, not virtualization - see `types.ts`'s doc comment and
 * ADR/architecture doc for why, and how this slot can be swapped for a
 * virtualized list later without changing this component's props.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { formatDateTimeLocalized } from '@/lib/thaiDate';
import { ActivityEvent, ActivityFilter } from './types';
import { matchesFilter, matchesSearch } from './activityLabels';
import ActivityEventRow from './ActivityEventRow';

const FILTERS: ActivityFilter[] = ['all', 'edits', 'status', 'photos', 'comments', 'assignments', 'pinned'];
const FILTER_LABEL_KEY: Record<ActivityFilter, string> = {
  all: 'activityTimeline.filterAll',
  edits: 'activityTimeline.filterEdits',
  status: 'activityTimeline.filterStatus',
  photos: 'activityTimeline.filterPhotos',
  comments: 'activityTimeline.filterComments',
  assignments: 'activityTimeline.filterAssignments',
  pinned: 'activityTimeline.filterPinned',
};

const PAGE_SIZE = 50;

export interface ActivityTimelineProps {
  events: ActivityEvent[];
  /** Human noun for this module's record ("Report" for MQR) - see
   *  `activityLabels.ts`'s doc comment. */
  entityLabel: string;
  /** Quick Navigation - the page decides what a target actually scrolls to
   *  (or does nothing, if it has no matching section); the component only
   *  ever emits the generic target key. */
  onNavigate?: (target: NonNullable<ActivityEvent['navigationTarget']>) => void;
  /** Additive, like `onNavigate` - a cross-module feed (Platform Overview's
   *  "Today's Activities") passes this so each row links out to the record
   *  it's actually about (see `getActivityEntityHref` in
   *  `mapAuditLogToActivityEvents.ts`). A single-record page's own timeline
   *  omits it - that page already *is* the record, a self-link would be a
   *  no-op link, not a fix. Returning `null`/undefined renders no link for
   *  that event, same as omitting the prop entirely. */
  getEntityHref?: (event: ActivityEvent) => string | null | undefined;
  /** MQR-only migration flag; other timeline consumers retain their current
   * renderer until their own image-platform migration. */
  useImagePlatform?: boolean;
}

export default function ActivityTimeline({ events, entityLabel, onNavigate, getEntityHref, useImagePlatform = false }: ActivityTimelineProps) {
  const { t, locale } = useTranslation();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Pinned events always float to the top (spec: "Pinned events always
  // remain at the top") - stable otherwise, since `events` is already
  // newest-first from the adapter.
  const sorted = useMemo(() => {
    const pinned = events.filter((e) => e.pinned);
    const rest = events.filter((e) => !e.pinned);
    return [...pinned, ...rest];
  }, [events]);

  const filtered = useMemo(
    () => sorted.filter((e) => matchesFilter(e, filter) && matchesSearch(e, query)),
    [sorted, filter, query]
  );

  const visible = filtered.slice(0, visibleCount);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-brand-dark">{t('activityTimeline.title')}</h2>
        {/* Future AI Support - architecture-compatible placeholder only,
         *  per the explicit "do not implement AI yet" requirement. */}
        <button
          type="button"
          disabled
          title={t('activityTimeline.summarizeTimeline')}
          className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-400 cursor-not-allowed"
        >
          {t('activityTimeline.summarizeTimeline')}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setFilter(f);
              setVisibleCount(PAGE_SIZE);
            }}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              filter === f ? 'bg-brand-dark text-white border-brand-dark' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t(FILTER_LABEL_KEY[f])}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setVisibleCount(PAGE_SIZE);
        }}
        placeholder={t('activityTimeline.searchPlaceholder')}
        className="w-full sm:w-80 border border-gray-300 rounded px-3 py-2 text-sm"
      />

      {visible.length === 0 ? (
        <p className="text-sm text-gray-400">
          {events.length === 0 ? t('activityTimeline.noEvents') : t('activityTimeline.noMatchingEvents')}
        </p>
      ) : (
        <ol className="space-y-3">
          {visible.map((event) => (
            <ActivityEventRow
              key={event.eventId}
              event={event}
              entityLabel={entityLabel}
              t={t}
              formattedDate={formatDateTimeLocalized(event.timestamp, locale)}
              onNavigate={onNavigate}
              getEntityHref={getEntityHref}
              useImagePlatform={useImagePlatform}
            />
          ))}
        </ol>
      )}

      {filtered.length > visibleCount && (
        <button
          type="button"
          onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          className="text-sm px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          {t('activityTimeline.loadMore')} ({filtered.length - visibleCount})
        </button>
      )}
    </div>
  );
}
