'use client';

import ActivityTimeline from '@/components/shared/activity-timeline/ActivityTimeline';
import { ActivityEvent } from '@/components/shared/activity-timeline/types';
import { getActivityEntityHref } from '@/components/shared/activity-timeline/mapAuditLogToActivityEvents';

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
  return <ActivityTimeline events={events} entityLabel="Record" getEntityHref={getActivityEntityHref} />;
}
