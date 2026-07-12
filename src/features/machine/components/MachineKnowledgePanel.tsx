import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';

/**
 * Machine Digital Passport - Knowledge Integration section. Placeholders
 * only, per the explicit "do not implement AI yet" requirement - reuses the
 * platform's one `EmptyState` component in its `comingSoon` tone (MSEAL
 * Design Framework, ADR-023, EMPTY_STATE_GUIDELINE.md) rather than a new
 * "coming soon" treatment invented for this page.
 *
 * v1.1 refinement adds Knowledge Score - a single reserved metric tile
 * (how well-documented/understood this machine's known issues are),
 * same placeholder treatment as the other five tiles - no scoring logic
 * exists anywhere to back it yet.
 */
// Troubleshooting is deliberately not a tile here (UI Terminology &
// Navigation Cleanup) - it now has its own reserved section/nav entry
// (`MachineTroubleshootingPanel`, Quality-owned per navConfig.ts), so it
// isn't duplicated inside Knowledge Integration too.
const ITEMS: { icon: string; titleKey: string }[] = [
  { icon: '🧠', titleKey: 'machinePassport.knowledgeCases' },
  { icon: '📋', titleKey: 'machinePassport.knownProblems' },
  { icon: '🤖', titleKey: 'machinePassport.aiRecommendation' },
  { icon: '🔮', titleKey: 'machinePassport.prediction' },
  { icon: '📈', titleKey: 'machinePassport.knowledgeScore' },
];

export default function MachineKnowledgePanel() {
  return (
    <Card variant="compact" className="p-6" as="section" id="knowledge">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.knowledgeTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <EmptyState
            key={item.titleKey}
            icon={item.icon}
            title={t(item.titleKey)}
            reason={t('machinePassport.knowledgeReason')}
            nextStep={t('machinePassport.knowledgeNextStep')}
            comingSoon
          />
        ))}
      </div>
    </Card>
  );
}
