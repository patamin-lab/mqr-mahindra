import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';

/**
 * Machine Digital Passport v1.1 refinement - Reserved AI panels. Distinct
 * from the Knowledge Integration section (human/process knowledge -
 * cases, known problems, troubleshooting): this section is reserved for
 * the "Machine Intelligence" phase of `docs/ROADMAP.md`'s Next Development
 * Phase priority order (Workflow Engine -> Service Management -> Customer
 * Experience -> Machine Intelligence -> Predictive Maintenance) - no
 * model, no inference endpoint, no scoring logic exists anywhere yet.
 * Same `EmptyState` `comingSoon` tone as every other placeholder on this
 * page - no new "reserved" treatment invented for this section.
 */
const ITEMS: { icon: string; titleKey: string }[] = [
  { icon: '🩺', titleKey: 'machinePassport.aiDiagnosticAssistant' },
  { icon: '⚠️', titleKey: 'machinePassport.aiPredictiveFailureAlert' },
  { icon: '🔎', titleKey: 'machinePassport.aiRootCauseSuggestion' },
];

export default function MachineAiInsightsPanel() {
  return (
    <Card variant="compact" className="p-6" as="section" id="ai-insights">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.aiInsightsTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <EmptyState
            key={item.titleKey}
            icon={item.icon}
            title={t(item.titleKey)}
            reason={t('machinePassport.aiInsightsReason')}
            nextStep={t('machinePassport.aiInsightsNextStep')}
            comingSoon
          />
        ))}
      </div>
    </Card>
  );
}
