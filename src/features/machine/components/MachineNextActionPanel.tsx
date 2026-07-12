import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';

/**
 * Machine Digital Passport v1.2 refinement - Next Recommended Action
 * placeholder. Documented as the future AI entry point for this machine
 * (a single "what should I do next" recommendation, once Machine
 * Intelligence exists) - no backend, no model, no recommendation logic
 * of any kind. Reuses `EmptyState` in its `comingSoon` tone, same as
 * every other placeholder on this page; not merged into the Reserved AI
 * panels section since this one is meant to sit prominently near the top
 * of the Passport (the single "next step" prompt), while Reserved AI
 * panels lower on the page are the broader set of future AI capabilities.
 */
export default function MachineNextActionPanel() {
  return (
    <Card variant="compact" className="p-6" as="section" id="next-action">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.nextActionTitle')}</h2>
      <EmptyState
        icon="🧭"
        title={t('machinePassport.nextActionTitle')}
        reason={t('machinePassport.nextActionReason')}
        nextStep={t('machinePassport.nextActionNextStep')}
        comingSoon
      />
    </Card>
  );
}
