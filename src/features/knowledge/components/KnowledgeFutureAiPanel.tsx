import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';

/**
 * Reserved Future AI Panel (Screen Contract §12) — placeholders only, per
 * this build's explicit "do not build AI" scope. Four Coming Soon tiles,
 * each captioned with the one binding rule that must hold whenever this
 * panel is ever implemented: **AI must always cite Evidence.**
 */
const ITEMS = ['aiSummaryTitle', 'aiRecommendationTitle', 'aiRootCauseTitle', 'aiSimilarCasesTitle'] as const;

export default function KnowledgeFutureAiPanel() {
  return (
    <Card variant="compact" className="p-6" as="section" id="future-ai">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('knowledge.futureAiTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {ITEMS.map((key) => (
          <EmptyState key={key} icon="🤖" title={t(`knowledge.${key}`)} reason={t('knowledge.aiReservedReason')} nextStep={t('knowledge.aiReservedNextStep')} comingSoon />
        ))}
      </div>
    </Card>
  );
}
