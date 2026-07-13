'use client';

/**
 * Evidence list + "Add Evidence" form. File attachments on a specific
 * evidence item are not wired into this form in v1 (explicitly deferred,
 * see KNOWLEDGE_PLATFORM.md §10) - the data model and
 * `AttachmentService`/`/api/attachments` route already support it
 * (`module: 'knowledge'`, `entityType: 'evidence'`), only this form's file
 * picker isn't built yet.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError, swalSuccessToast } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';
import EmptyState from '@/components/shared/layout/EmptyState';
import { KNOWLEDGE_CONFIDENCE_LEVELS, type KnowledgeEvidence, type KnowledgeEvidenceSourceType, type KnowledgeConfidenceLevel } from '../types';

const SOURCE_TYPES: KnowledgeEvidenceSourceType[] = ['Quality', 'PM', 'Warranty', 'Machine', 'Dealer', 'Customer', 'Engineer', 'IoT'];

export default function KnowledgeEvidenceSection({ caseId, evidence }: { caseId: string; evidence: KnowledgeEvidence[] }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sourceType, setSourceType] = useState<KnowledgeEvidenceSourceType>('Engineer');
  const [machineSerial, setMachineSerial] = useState('');
  const [observedAt, setObservedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [confidence, setConfidence] = useState<KnowledgeConfidenceLevel | ''>('');
  const [summary, setSummary] = useState('');

  async function submit() {
    if (!summary.trim()) {
      swalError(t('knowledge.evidenceSummaryRequired'));
      return;
    }
    setSaving(true);
    try {
      await fetchJson(`/api/knowledge-cases/${caseId}/evidence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceType,
          machineSerial: machineSerial || null,
          observedAt,
          confidence: confidence || null,
          summary,
        }),
      });
      swalSuccessToast(t('knowledge.addEvidenceAction'));
      setAdding(false);
      setSummary('');
      setMachineSerial('');
      setConfidence('');
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="flat" className="p-5 space-y-3" as="section" id="evidence">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-brand-dark">{t('knowledge.evidenceTitle')}</h2>
        <button type="button" onClick={() => setAdding((v) => !v)} className="text-xs text-brand-red hover:underline">
          {t('knowledge.addEvidenceAction')}
        </button>
      </div>

      {adding && (
        <div className="space-y-2 rounded border border-gray-200 p-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium mb-1">{t('knowledge.evidenceSourceTypeLabel')}</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as KnowledgeEvidenceSourceType)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                {SOURCE_TYPES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('knowledge.evidenceDateLabel')}</label>
              <input
                type="date"
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('common.serial')}</label>
              <input
                value={machineSerial}
                onChange={(e) => setMachineSerial(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">{t('knowledge.evidenceConfidenceLabel')}</label>
              <select
                value={confidence}
                onChange={(e) => setConfidence(e.target.value as KnowledgeConfidenceLevel | '')}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">-</option>
                {KNOWLEDGE_CONFIDENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {t(`knowledge.confidence.${level}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{t('knowledge.evidenceSummaryLabel')}</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={2}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
          <button type="button" onClick={submit} disabled={saving} className="btn-primary text-xs">
            {saving ? '...' : t('common.save')}
          </button>
        </div>
      )}

      {evidence.length === 0 ? (
        <EmptyState icon="🔎" title={t('knowledge.evidenceTitle')} reason={t('knowledge.noEvidenceReason')} nextStep={t('knowledge.noEvidenceNextStep')} />
      ) : (
        <ul className="space-y-2">
          {evidence.map((e) => (
            <li key={e.id} id={`evidence-${e.id}`} className="rounded border border-gray-100 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-brand-dark">{e.sourceType}</span>
                <span className="text-xs text-gray-500">
                  {e.author} · {e.observedAt}
                  {e.confidence ? ` · ${t(`knowledge.confidence.${e.confidence}`)}` : ''}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">{e.summary}</p>
              {e.machineSerial && <p className="mt-1 text-xs text-gray-400">{t('common.serial')}: {e.machineSerial}</p>}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
