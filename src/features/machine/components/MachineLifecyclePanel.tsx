import Card from '@/components/shared/layout/Card';
import StatusPill from '@/components/shared/status/StatusPill';
import Timeline from '@/components/shared/timeline/Timeline';
import MachineTimelineRow from './MachineTimelineRow';
import { t } from '@/lib/i18n/server';
import { MachineEvent, MachineSummary } from '../types';

interface StageFlag {
  labelKey: string;
  reached: boolean | 'comingSoon';
}

/**
 * Machine Digital Passport - Lifecycle section. Two distinct pieces, both
 * reused rather than reinvented:
 *
 * 1. Stage badges (Imported/Registered/Delivered/Warranty/PM/Quality/PIP/
 *    Recall/Retired) - derived entirely from fields `MachineSummary`
 *    already carries (`lastMaintenanceDate` for PM, `openMqrCount` for
 *    Quality), so this section stays on the fast "core" fetch path with no
 *    extra query of its own - Warranty/PM/Quality's own panels below fetch
 *    their full detail independently/lazily. There is no dedicated
 *    "Registered" milestone anywhere in the schema (only one NTR-driven
 *    `retailDate`/`lifecycleStatus` transition exists) - Registered and
 *    Delivered are shown from the same signal, documented honestly in
 *    `docs/architecture/MACHINE_LIFECYCLE.md` rather than faked as two
 *    independent events. PIP/Recall have no data source yet (Engineering
 *    Intelligence, not yet built) - shown as Coming Soon, matching the
 *    nav's own Coming Soon treatment for those same modules.
 * 2. The milestone timeline itself - the exact same `MachineService.
 *    getMachineTimeline()` + `MachineTimelineRow` Vehicle 360 already
 *    renders, not a second copy.
 */
export default function MachineLifecyclePanel({ summary, timeline }: { summary: MachineSummary; timeline: MachineEvent[] }) {
  const delivered = summary.retailDate != null;
  const retired = summary.lifecycleStatus === 'Scrapped' || summary.lifecycleStatus === 'Inactive';

  const stages: StageFlag[] = [
    { labelKey: 'machinePassport.lifecycleImported', reached: true },
    { labelKey: 'machinePassport.lifecycleRegistered', reached: delivered },
    { labelKey: 'machinePassport.lifecycleDelivered', reached: delivered },
    { labelKey: 'machinePassport.lifecycleWarranty', reached: delivered },
    { labelKey: 'machinePassport.lifecyclePm', reached: summary.lastMaintenanceDate != null },
    { labelKey: 'machinePassport.lifecycleQuality', reached: summary.openMqrCount > 0 },
    { labelKey: 'machinePassport.lifecyclePip', reached: 'comingSoon' },
    { labelKey: 'machinePassport.lifecycleRecall', reached: 'comingSoon' },
    { labelKey: 'machinePassport.lifecycleRetired', reached: retired },
  ];

  return (
    <Card variant="compact" className="p-6" as="section" id="lifecycle">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.lifecycleTitle')}</h2>
      <div className="flex flex-wrap gap-2">
        {stages.map((stage) => (
          <StatusPill
            key={stage.labelKey}
            colorClassName={
              stage.reached === 'comingSoon'
                ? 'bg-gray-100 text-gray-400'
                : stage.reached
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-500'
            }
          >
            {t(stage.labelKey)}
            {stage.reached === 'comingSoon' ? ` (${t('nav.comingSoon')})` : ''}
          </StatusPill>
        ))}
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {t('machinePassport.milestonesTitle')}
      </h3>
      {timeline.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">{t('vehicle360.noTimelineEvents')}</p>
      ) : (
        <Timeline className="space-y-3">
          {timeline.map((event, idx) => (
            <MachineTimelineRow key={`${event.type}-${event.referenceNumber}-${idx}`} event={event} />
          ))}
        </Timeline>
      )}
    </Card>
  );
}
