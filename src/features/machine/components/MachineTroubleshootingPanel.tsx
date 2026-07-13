import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';

/**
 * Machine Digital Passport - Troubleshooting (Reserved). UI Terminology &
 * Navigation Cleanup: Troubleshooting is Quality-owned (an operational
 * execution activity - technicians diagnosing an active quality problem),
 * distinct from Knowledge Integration (human/process knowledge - cases,
 * known problems) and from Engineering Intelligence's AI Engineering/PIP/
 * Predictive Quality (analysis produced from Quality's data, not execution
 * itself). Exactly one reserved entry for this capability across the whole
 * Passport - not duplicated inside Knowledge Integration.
 *
 * Same `EmptyState` `comingSoon` tone as every other placeholder on this
 * page - no new "reserved" treatment invented for this section, and no
 * implementation: no diagnostic model, no decision tree, no repair
 * procedure content exists anywhere yet.
 */
export default function MachineTroubleshootingPanel() {
  return (
    <Card variant="compact" className="p-6" as="section" id="troubleshooting">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.troubleshootingTitle')}</h2>
      <EmptyState
        icon="🛠️"
        title={t('machinePassport.troubleshootingTitle')}
        reason={t('machinePassport.troubleshootingReason')}
        nextStep={t('machinePassport.troubleshootingNextStep')}
        comingSoon
      />
    </Card>
  );
}
