import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';
import { t } from '@/lib/i18n/server';
import PageHeader from '@/components/shared/layout/PageHeader';
import NewKnowledgeCandidateForm from './NewKnowledgeCandidateForm';

/** Create a Knowledge Candidate (`maturity: 'Draft'`). Open to every
 *  role - see `canTransitionKnowledgeMaturity`'s doc comment. */
export default async function NewKnowledgeCandidatePage() {
  const session = await getSession();
  if (!session) return null;

  const productFamilies = await MasterDataService.getActiveProductFamilies();

  return (
    <div className="space-y-4">
      <PageHeader title={t('knowledge.createTitle')} subtitle={t('knowledge.createSubtitle')} titleClassName="text-xl font-bold text-brand-dark" />
      <NewKnowledgeCandidateForm productFamilies={productFamilies.map((f) => ({ id: f.id, name: f.name }))} />
    </div>
  );
}
