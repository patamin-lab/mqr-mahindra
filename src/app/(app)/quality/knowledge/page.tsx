import Link from 'next/link';
import { getSession } from '@/lib/auth';
import { KnowledgeService, KNOWLEDGE_MATURITY_VALUES, type KnowledgeMaturity } from '@/features/knowledge';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import SearchToolbar from '@/components/shared/layout/SearchToolbar';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import MaturityPill from '@/features/knowledge/components/MaturityPill';
import ConfidencePill from '@/features/knowledge/components/ConfidencePill';

const service = new KnowledgeService();

/**
 * Engineering Knowledge Platform (ADR-018) — Knowledge list. "Knowledge
 * Candidate" and "Knowledge Case" are the same table, filtered by
 * `maturity` — this one screen serves both, per the Screen Contract in
 * `docs/architecture/KNOWLEDGE_PLATFORM.md` §6. Quality-owned: this is
 * the real route the existing `nav.qualityKnowledge` Coming Soon entry
 * now points to (`navConfig.ts`) — no new nav item was added.
 *
 * Screen Contract summary: Purpose — find a Knowledge Candidate/Case by
 * symptom or triage what needs Engineering Review. Primary User —
 * Technician (browse/create), Engineer/Admin (review). Primary Decision —
 * "is there already validated knowledge for this symptom." Primary
 * Action — open a case, or create a new Candidate. Permissions — every
 * authenticated role may view/create; Engineering Review actions are
 * gated on the detail screen by `canReviewKnowledge` (`lib/scope.ts`).
 * Timeline — none on the list screen (each case has its own, on detail).
 */
export default async function KnowledgeListPage({
  searchParams,
}: {
  searchParams: { maturity?: string; q?: string };
}) {
  const session = await getSession();
  if (!session) return null;

  const maturity = KNOWLEDGE_MATURITY_VALUES.includes(searchParams.maturity as KnowledgeMaturity)
    ? (searchParams.maturity as KnowledgeMaturity)
    : undefined;
  const cases = await service.listCases({ maturity, q: searchParams.q });

  const clearHref = searchParams.q || searchParams.maturity ? '/quality/knowledge' : undefined;

  return (
    <div>
      <PageHeader
        title={t('knowledge.title')}
        subtitle={t('knowledge.subtitle')}
        titleClassName="text-2xl font-bold text-brand-dark"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4"
        actions={
          <Link href="/quality/knowledge/new" className="btn-primary">
            {t('knowledge.newCandidateAction')}
          </Link>
        }
      />

      <SearchToolbar
        cardClassName="p-4 mb-4 flex flex-wrap gap-3 items-end"
        filterLabel={t('common.filter')}
        filterButtonClassName="px-4 py-2 rounded border border-gray-300 text-sm bg-gray-50 hover:bg-gray-100 transition"
        clearHref={clearHref}
        clearLabel={t('common.clearFilter')}
      >
        <div>
          <label className="block text-xs font-medium mb-1">{t('common.search')}</label>
          <input
            name="q"
            defaultValue={searchParams.q ?? ''}
            placeholder={t('knowledge.searchPlaceholder')}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-64"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">{t('knowledge.maturityLabel')}</label>
          <select name="maturity" defaultValue={searchParams.maturity ?? ''} className="border border-gray-300 rounded px-3 py-2 text-sm">
            <option value="">{t('knowledge.maturityAllLabel')}</option>
            {KNOWLEDGE_MATURITY_VALUES.map((m) => (
              <option key={m} value={m}>
                {t(`knowledge.maturity.${m}`)}
              </option>
            ))}
          </select>
        </div>
      </SearchToolbar>

      {cases.length === 0 ? (
        <EmptyState icon="🧠" title={t('knowledge.title')} reason={t('knowledge.emptyListReason')} nextStep={t('knowledge.emptyListNextStep')} />
      ) : (
        <Card variant="elevated" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">{t('knowledge.caseRefLabel')}</th>
                <th className="text-left px-4 py-3">{t('knowledge.symptomLabel')}</th>
                <th className="text-left px-4 py-3">{t('knowledge.affectedSystemLabel')}</th>
                <th className="text-left px-4 py-3">{t('knowledge.maturityLabel')}</th>
                <th className="text-left px-4 py-3">{t('knowledge.confidenceLabel')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">
                    <Link href={`/quality/knowledge/${c.id}`} className="text-brand-red hover:underline">
                      {c.caseRef}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{c.symptom}</td>
                  <td className="px-4 py-3 text-gray-500">{c.affectedSystem ?? '-'}</td>
                  <td className="px-4 py-3">
                    <MaturityPill maturity={c.maturity} label={t(`knowledge.maturity.${c.maturity}`)} />
                  </td>
                  <td className="px-4 py-3">
                    <ConfidencePill confidence={c.confidence} label={t(`knowledge.confidence.${c.confidence}`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
