'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';
import type { Severity } from '@/lib/types';
import type { Finding, FactoryFeedbackStatus } from '../types';

const SEVERITIES: Severity[] = ['Critical', 'Major', 'Minor'];
const FACTORY_FEEDBACK_STATUSES: FactoryFeedbackStatus[] = ['NotSent', 'Sent', 'Acknowledged', 'ActionTaken'];

/** Structured Findings may become Knowledge Candidates - "do not
 *  duplicate entry" (task brief). The "Promote to Knowledge" button calls
 *  `InspectionService.promoteFindingToKnowledge()` directly - there is no
 *  second Knowledge-entry form anywhere in this component. */
export default function FindingsSection({ inspectionId, findings, canEdit }: { inspectionId: string; findings: Finding[]; canEdit: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [severity, setSeverity] = useState<Severity>('Minor');
  const [system, setSystem] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  async function addFinding() {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await fetchJson(`/api/inspections/${inspectionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ finding: { severity, system, description } }),
      });
      setSystem('');
      setDescription('');
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function promote(findingId: string) {
    setPromotingId(findingId);
    try {
      await fetchJson(`/api/inspections/${inspectionId}/findings/${findingId}/promote-to-knowledge`, { method: 'POST' });
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setPromotingId(null);
    }
  }

  async function setFactoryFeedbackStatus(findingId: string, factoryFeedbackStatus: FactoryFeedbackStatus) {
    try {
      await fetchJson(`/api/inspections/${inspectionId}/findings/${findingId}/factory-feedback`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ factoryFeedbackStatus }),
      });
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Card variant="flat" className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('pdi.findingsTitle')}</h2>
      {findings.length === 0 ? (
        <p className="mb-3 text-xs text-gray-400">{t('pdi.noFindingsReason')}</p>
      ) : (
        <ul className="mb-4 space-y-2">
          {findings.map((f) => (
            <li key={f.id} className="rounded border border-gray-100 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-brand-dark">
                  [{f.severity}] {f.system}
                </span>
                {f.knowledgeCaseId ? (
                  <Link href={`/quality/knowledge/${f.knowledgeCaseId}`} className="text-xs text-brand-red hover:underline">
                    {t('pdi.promotedToKnowledgeLabel')} →
                  </Link>
                ) : (
                  canEdit && (
                    <button type="button" onClick={() => promote(f.id)} disabled={promotingId === f.id} className="text-xs text-brand-red hover:underline">
                      {promotingId === f.id ? '...' : t('pdi.promoteToKnowledgeAction')}
                    </button>
                  )
                )}
              </div>
              <p className="mt-1 text-xs text-gray-600">{f.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="text-xs text-gray-400">{t('pdi.factoryFeedbackStatusLabel')}</label>
                {canEdit ? (
                  <select
                    value={f.factoryFeedbackStatus}
                    onChange={(e) => setFactoryFeedbackStatus(f.id, e.target.value as FactoryFeedbackStatus)}
                    className="rounded border border-gray-300 px-2 py-0.5 text-xs"
                  >
                    {FACTORY_FEEDBACK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {t(`pdi.factoryFeedbackStatus.${s}`)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-gray-500">{t(`pdi.factoryFeedbackStatus.${f.factoryFeedbackStatus}`)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity)} className="rounded border border-gray-300 px-2 py-1 text-xs">
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            placeholder={t('pdi.findingSystemLabel')}
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            className="w-32 rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <input
            placeholder={t('pdi.findingDescriptionLabel')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-64 rounded border border-gray-300 px-2 py-1 text-xs"
          />
          <button type="button" onClick={addFinding} disabled={saving} className="rounded bg-gray-100 px-3 py-1 text-xs hover:bg-gray-200">
            {saving ? '...' : t('pdi.addFindingAction')}
          </button>
        </div>
      )}
    </Card>
  );
}
