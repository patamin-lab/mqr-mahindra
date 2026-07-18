import Card from '@/components/shared/layout/Card';
import ActivityTimeline from '@/components/shared/activity-timeline/ActivityTimeline';
import { ActivityEvent } from '@/components/shared/activity-timeline/types';
import { t } from '@/lib/i18n/server';

/**
 * Machine Digital Passport - "Machine Timeline" (field-level activity),
 * fed by `MachineService.getMachineAuditTimeline()`. Reuses the platform's
 * one `<ActivityTimeline>` component (MSEAL Design Framework, ADR-023) -
 * the same component MQR/PM/NTR detail pages and Platform Overview's
 * "Today's Activities" widget already render, just scoped to this one
 * machine's own records across every module instead of one record or one
 * day. Distinct from - not a duplicate of - the Lifecycle section's
 * milestone timeline; see `docs/architecture/MACHINE_PASSPORT_ARCHITECTURE.md`.
 */
export default function MachineActivityPanel({ events }: { events: ActivityEvent[] }) {
  return (
    <Card variant="compact" className="p-6" as="section" id="activity">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.activityTitle')}</h2>
      <ActivityTimeline events={events} entityLabel="Machine" useImagePlatform />
    </Card>
  );
}
