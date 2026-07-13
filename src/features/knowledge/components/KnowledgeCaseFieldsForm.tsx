'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { swalError, swalSuccessToast } from '@/lib/swal';
import { fetchJson } from '@/lib/fetchJson';
import Card from '@/components/shared/layout/Card';
import type { KnowledgeCase, KnowledgeConfidenceLevel } from '../types';
import { KNOWLEDGE_CONFIDENCE_LEVELS } from '../types';

/** Editable Case fields — Symptom/Possible Causes/Validated Fix/
 *  Verification Steps/Confidence. Locked (read-only) once
 *  `maturity === 'Published'` unless the viewer can Engineering Review
 *  (`canEdit`, computed server-side by the page and passed down — the
 *  real enforcement is the API route's own `canReviewKnowledge` check,
 *  this only controls whether the form renders as editable). */
export default function KnowledgeCaseFieldsForm({ kase, canEdit }: { kase: KnowledgeCase; canEdit: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [symptom, setSymptom] = useState(kase.symptom);
  const [affectedSystem, setAffectedSystem] = useState(kase.affectedSystem ?? '');
  const [possibleCauses, setPossibleCauses] = useState(kase.possibleCauses.map((c) => c.cause));
  const [validatedFix, setValidatedFix] = useState(kase.validatedFix ?? '');
  const [verificationSteps, setVerificationSteps] = useState(kase.verificationSteps.map((s) => s.step));
  const [confidence, setConfidence] = useState<KnowledgeConfidenceLevel>(kase.confidence);
  const [saving, setSaving] = useState(false);

  function updateList(list: string[], index: number, value: string, setList: (v: string[]) => void) {
    const next = [...list];
    next[index] = value;
    setList(next);
  }

  async function save() {
    setSaving(true);
    try {
      await fetchJson(`/api/knowledge-cases/${kase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptom,
          affectedSystem: affectedSystem || null,
          possibleCauses: possibleCauses.filter((c) => c.trim()).map((cause) => ({ cause })),
          validatedFix: validatedFix || null,
          verificationSteps: verificationSteps.filter((s) => s.trim()).map((step) => ({ step })),
          confidence,
        }),
      });
      swalSuccessToast(t('common.save'));
      router.refresh();
    } catch (err) {
      swalError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="flat" className="p-5 space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1">{t('knowledge.symptomLabel')}</label>
        <textarea
          value={symptom}
          disabled={!canEdit}
          onChange={(e) => setSymptom(e.target.value)}
          rows={2}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">{t('knowledge.affectedSystemLabel')}</label>
        <input
          value={affectedSystem}
          disabled={!canEdit}
          onChange={(e) => setAffectedSystem(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">{t('knowledge.possibleCausesLabel')}</label>
        {possibleCauses.map((cause, i) => (
          <input
            key={i}
            value={cause}
            disabled={!canEdit}
            onChange={(e) => updateList(possibleCauses, i, e.target.value, setPossibleCauses)}
            className="mb-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
          />
        ))}
        {canEdit && (
          <button type="button" onClick={() => setPossibleCauses([...possibleCauses, ''])} className="text-xs text-brand-red hover:underline">
            + {t('knowledge.possibleCausesLabel')}
          </button>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">{t('knowledge.validatedFixLabel')}</label>
        <textarea
          value={validatedFix}
          disabled={!canEdit}
          onChange={(e) => setValidatedFix(e.target.value)}
          rows={3}
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">{t('knowledge.verificationStepsLabel')}</label>
        {verificationSteps.map((step, i) => (
          <input
            key={i}
            value={step}
            disabled={!canEdit}
            onChange={(e) => updateList(verificationSteps, i, e.target.value, setVerificationSteps)}
            className="mb-1 w-full rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
          />
        ))}
        {canEdit && (
          <button type="button" onClick={() => setVerificationSteps([...verificationSteps, ''])} className="text-xs text-brand-red hover:underline">
            + {t('knowledge.verificationStepsLabel')}
          </button>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium mb-1">{t('knowledge.confidenceLabel')}</label>
        <select
          value={confidence}
          disabled={!canEdit}
          onChange={(e) => setConfidence(e.target.value as KnowledgeConfidenceLevel)}
          className="rounded border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        >
          {KNOWLEDGE_CONFIDENCE_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(`knowledge.confidence.${level}`)}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-400">{t('knowledge.confidenceManualNote')}</p>
      </div>
      {canEdit && (
        <button type="button" onClick={save} disabled={saving} className="btn-primary">
          {saving ? '...' : t('common.save')}
        </button>
      )}
    </Card>
  );
}
