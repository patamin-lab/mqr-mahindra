'use client';

import ActivityTimeline from '@/components/shared/activity-timeline/ActivityTimeline';
import { ActivityEvent } from '@/components/shared/activity-timeline/types';
import { getActivityEntityHref } from '@/components/shared/activity-timeline/mapAuditLogToActivityEvents';
import { useTranslation } from '@/lib/i18n/LocaleProvider';

/**
 * Client Component wrapper - required by the Next.js App Router rule that a
 * Server Component can never pass a function prop directly to a Client
 * Component (only serializable data may cross that boundary). Every other
 * `<ActivityTimeline>` caller already follows this same pattern for its own
 * callback (see `records/[jobId]/activity-timeline-section.tsx`'s
 * `onNavigate`) - `getActivityEntityHref` is imported and called from
 * *inside* this client boundary instead of being passed in from the async
 * Server Component `dashboard/page.tsx`. Only `events` (already-fetched,
 * plain data) crosses the boundary.
 */
export default function DashboardActivityTimelineSection({ events }: { events: ActivityEvent[] }) {
  const { t } = useTranslation();
  return <ActivityTimeline events={events} entityLabel={t('dashboard.activityEntityLabel')} getEntityHref={getActivityEntityHref} />;
}
