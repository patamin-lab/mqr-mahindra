'use client';

/**
 * The Engineering Review action (and every other maturity move). Button
 * visibility here is UX only - `canTransitionKnowledgeMaturity` is
 * re-checked server-side by `PATCH /api/knowledge-cases/[id]/maturity`
 * (`SECURITY_STANDARD.md`: nav/button visibility is never the real gate).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError, swalSuccessToast } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import { KNOWLEDGE_MATURITY_TRANSITIONS, canTransitionKnowledgeMaturity, type KnowledgeMaturity } from '../types';
import type { Role } from '@/lib/types';
import MaturityPill from './MaturityPill';

const ACTION_KEY: Partial<Record<KnowledgeMaturity, string>> = {
  Review: 'knowledge.submitForReviewAction',
  Draft: 'knowledge.sendBackToDraftAction',
  Published: 'knowledge.publishAction',
  Deprecated: 'knowledge.deprecateAction',
  Archived: 'knowledge.archiveAction',
};

export default function KnowledgeMaturityControl({
  caseId,
  maturity,
  role,
}: {
  caseId: string;
  maturity: KnowledgeMaturity;
  role: Role;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const [busy, setBusy] = useState<KnowledgeMaturity | null>(null);

  const options = (KNOWLEDGE_MATURITY_TRANSITIONS[maturity] ?? []).filter((to) => canTransitionKnowledgeMaturity(maturity, to, role));

  async function transition(to: KnowledgeMaturity) {
    setBusy(to);
    try {
      await fetchJson(`/api/knowledge-cases/${caseId}/maturity`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maturity: to }),
      });
      swalSuccessToast(t(`knowledge.maturity.${to}`));
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MaturityPill maturity={maturity} label={t(`knowledge.maturity.${maturity}`)} />
      {options.map((to) => (
        <button
          key={to}
          type="button"
          disabled={busy !== null}
          onClick={() => transition(to)}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          {busy === to ? '...' : t(ACTION_KEY[to] ?? `knowledge.maturity.${to}`)}
        </button>
      ))}
    </div>
  );
}
