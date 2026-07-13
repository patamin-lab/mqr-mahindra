import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';

/**
 * Reserved Future AI Panel - placeholders only, per this build's explicit
 * "no AI implementation" scope. Four Coming Soon tiles (AI Delivery
 * Review/AI Delivery Risk/AI Readiness/AI Recommendation), each
 * captioned with the binding rule that must hold whenever this panel is
 * ever implemented: **AI must always cite Evidence.** Same shape as
 * `KnowledgeFutureAiPanel`.
 */
const ITEMS = ['aiDeliveryReviewTitle', 'aiDeliveryRiskTitle', 'aiReadinessTitle', 'aiRecommendationTitle'] as const;

export default function DeliveryFutureAiPanel() {
  return (
    <Card variant="compact" className="p-6" as="section" id="future-ai">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('delivery.futureAiTitle')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {ITEMS.map((key) => (
          <EmptyState key={key} icon="🤖" title={t(`delivery.${key}`)} reason={t('delivery.aiReservedReason')} nextStep={t('delivery.aiReservedNextStep')} comingSoon />
        ))}
      </div>
    </Card>
  );
}
