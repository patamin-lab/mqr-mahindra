import { getSession } from '@/lib/auth';
import { canManageLegacyImport } from '@/lib/scope';
import { t } from '@/lib/i18n/server';
import EmptyState from '@/components/shared/layout/EmptyState';
import LegacyImportTool from '@/features/ntr/components/legacy-import-tool';

export const dynamic = 'force-dynamic';

/**
 * Legacy Import - Super Administrator only. Hidden from every other role
 * both here (server-rendered access denial, not just a hidden nav entry)
 * and at every API route it calls - see
 * docs/standards/SECURITY_STANDARD.md §Application-layer authorization.
 */
export default async function LegacyImportPage() {
  const session = await getSession();
  if (!session) return null;

  if (!canManageLegacyImport(session.role)) {
    return (
      <EmptyState
        icon="🔒"
        title={t('importHistory.unauthorizedTitle')}
        reason={t('validation.unauthorizedLegacyImport')}
        nextStep={t('importHistory.unauthorizedNextStep')}
      />
    );
  }

  return <LegacyImportTool />;
}
