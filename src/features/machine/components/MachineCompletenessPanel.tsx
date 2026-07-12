import Card from '@/components/shared/layout/Card';
import StatusPill from '@/components/shared/status/StatusPill';
import EmptyState from '@/components/shared/layout/EmptyState';
import { t } from '@/lib/i18n/server';

const DIMENSION_KEYS = [
  'machinePassport.identityTitle',
  'machinePassport.ownershipTitle',
  'machinePassport.warrantyTitle',
  'machinePassport.pmTitle',
  'machinePassport.qualityTitle',
  'machinePassport.documentsTitle',
  'machinePassport.knowledgeTitle',
];

/**
 * Machine Digital Passport v1.2 refinement - Machine Completeness
 * placeholder. Reuses the same badge-row pattern the Lifecycle section
 * already uses for its stage badges (`StatusPill`) plus `EmptyState` for
 * the explanation - no new widget type invented. Explicitly a *future*
 * Data Quality indicator, not a live score: computing "how complete is
 * this machine's record" for real would need a defined weighting across
 * Identity/Owner/Warranty/PM/Quality/Documents/Knowledge that no one has
 * specified yet, so this section names the seven dimensions without
 * scoring any of them - the same "name it, don't fake it" treatment as
 * Knowledge Score/Reserved AI panels.
 */
export default function MachineCompletenessPanel() {
  return (
    <Card variant="compact" className="p-6" as="section" id="completeness">
      <h2 className="mb-3 text-sm font-semibold text-brand-dark">{t('machinePassport.completenessTitle')}</h2>
      <div className="flex flex-wrap gap-2">
        {DIMENSION_KEYS.map((key) => (
          <StatusPill key={key} colorClassName="bg-gray-100 text-gray-400">
            {t(key)} ({t('nav.comingSoon')})
          </StatusPill>
        ))}
      </div>
      <div className="mt-4">
        <EmptyState
          icon="📊"
          title={t('machinePassport.completenessTitle')}
          reason={t('machinePassport.completenessReason')}
          nextStep={t('machinePassport.completenessNextStep')}
          comingSoon
        />
      </div>
    </Card>
  );
}
