import TimelineItem from '@/components/shared/timeline/TimelineItem';
import { t } from '@/lib/i18n/server';
import { MachineEvent } from '../types';

/**
 * One row of a Machine Lifecycle milestone timeline (`MachineEvent[]`,
 * from `MachineService.getMachineTimeline()`). Extracted from
 * `vehicles/[serial]/page.tsx`'s previously-local `TimelineRow` so the
 * Machine Digital Passport (`/machines/[machineId]`) renders the exact
 * same milestone row, not a second copy - both pages import this one
 * component. Server-only (`lib/i18n/server`'s `t()`), matching where it
 * was already used.
 */
export default function MachineTimelineRow({ event }: { event: MachineEvent }) {
  return (
    <TimelineItem
      liClassName="rounded border border-gray-100 p-3 hover:bg-gray-50"
      href={event.href}
      date={event.date}
      badge={t(`vehicleEventType.${event.type}`)}
      leadingExtra={<span className="text-xs text-brand-red">{event.referenceNumber}</span>}
      trailing={event.status && <span className="text-xs text-gray-500">{event.status}</span>}
    >
      <p className="mt-1 text-sm text-gray-800">{event.description}</p>
      {event.user && <p className="mt-0.5 text-xs text-gray-400">{t('vehicle360.byUser', { user: event.user })}</p>}
    </TimelineItem>
  );
}
