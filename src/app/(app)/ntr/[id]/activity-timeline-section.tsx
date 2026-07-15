'use client';

import ActivityTimeline from '@/components/shared/activity-timeline/ActivityTimeline';
import { ActivityEvent } from '@/components/shared/activity-timeline/types';

/** Same shared `<ActivityTimeline>` MQR's `RecordActivityTimelineSection`
 *  uses - no `onNavigate` wired here since this record's detail page has
 *  no distinct status/RCA/warranty sub-sections to jump to (those are
 *  MQR-specific); the timeline still renders and filters normally
 *  without it. */
export default function NtrActivityTimelineSection({ events }: { events: ActivityEvent[] }) {
  return <ActivityTimeline events={events} entityLabel="NTR" />;
}
