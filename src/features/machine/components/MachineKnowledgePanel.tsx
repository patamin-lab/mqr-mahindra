import Link from 'next/link';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';
import type { MachineKnownIssue } from '@/features/knowledge';
import ConfidencePill from '@/features/knowledge/components/ConfidencePill';

/**
 * Machine Digital Passport - Knowledge Integration section.
 *
 * v1.4 (Engineering Knowledge Platform, ADR-018): "Known Problems"/
 * "Knowledge Cases" are now real - `MachineKnowledgeSection.tsx` passes
 * `knownIssues` from `MachineService.getMachineKnowledgeSummary()`
 * (Published Knowledge Cases only). "AI Recommendation," "Prediction,"
 * and "Knowledge Score" remain Coming Soon `EmptyState` tiles - this
 * build's explicit "do not build AI" scope, and Knowledge Score is
 * "concept only, not an implementation" per Blueprint ch.07. Machine
 * still owns no Knowledge data - this panel only ever renders what
 * `MachineService` already read through `KnowledgeService`.
 */
// Troubleshooting is deliberately not a tile here (UI Terminology &
// Navigation Cleanup) - it now has its own reserved section/nav entry
// (`MachineTroubleshootingPanel`, Quality-owned per navConfig.ts), so it
// isn't duplicated inside Knowledge Integration too.
const RESERVED_ITEMS: { icon: string; titleKey: string }[] = [
  { icon: '🤖', titleKey: 'machinePassport.aiRecommendation' },
  { icon: '🔮', titleKey: 'machinePassport.prediction' },
  { icon: '📈', titleKey: 'machinePassport.knowledgeScore' },
];

export default function MachineKnowledgePanel({ knownIssues }: { knownIssues: MachineKnownIssue[] }) {
  return (
    <Card variant="compact" className="p-6" as="section" id="knowledge">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.knowledgeTitle')}</h2>

      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('machinePassport.knowledgeCases')}</h3>
      {knownIssues.length === 0 ? (
        <EmptyState
          icon="🧠"
          title={t('machinePassport.knownProblems')}
          reason={t('machinePassport.knowledgeReason')}
          nextStep={t('machinePassport.knowledgeNextStep')}
        />
      ) : (
        <ul className="mb-4 space-y-2">
          {knownIssues.map((issue) => (
            <li key={issue.caseId} className="rounded border border-gray-100 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={issue.href} className="font-medium text-brand-red hover:underline">
                  {issue.caseRef}
                </Link>
                <ConfidencePill confidence={issue.confidence} label={t(`knowledge.confidence.${issue.confidence}`)} />
              </div>
              <p className="mt-1 text-xs text-gray-600">{issue.symptom}</p>
              {issue.validatedFix && <p className="mt-1 text-xs text-gray-400">{t('knowledge.validatedFixLabel')}: {issue.validatedFix}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RESERVED_ITEMS.map((item) => (
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
