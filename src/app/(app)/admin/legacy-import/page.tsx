import { getSession } from '@/lib/auth';
import { canManageLegacyImport } from '@/lib/scope';
import { t } from '@/lib/i18n/server';
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
      <div className="rounded border border-red-200 bg-red-50 p-6 text-red-700">
        <p>{t('validation.unauthorizedLegacyImport')}</p>
      </div>
    );
  }

  return <LegacyImportTool />;
}
