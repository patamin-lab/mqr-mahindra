'use client';

import ActivityTimeline from '@/components/shared/activity-timeline/ActivityTimeline';
import { ActivityEvent } from '@/components/shared/activity-timeline/types';

/** Maps the generic `navigationTarget` a timeline event carries to this
 *  page's actual DOM section ids - the shared `<ActivityTimeline>` itself
 *  never knows these ids exist (see its own doc comment). */
const SECTION_IDS: Record<NonNullable<ActivityEvent['navigationTarget']>, string> = {
  status: 'status-section',
  photos: 'photos-section',
  warranty: 'warranty-section',
  rca: 'rca-section',
};

export default function RecordActivityTimelineSection({ events }: { events: ActivityEvent[] }) {
  function handleNavigate(target: NonNullable<ActivityEvent['navigationTarget']>) {
    const id = SECTION_IDS[target];
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return <ActivityTimeline events={events} entityLabel="Report" onNavigate={handleNavigate} />;
}
