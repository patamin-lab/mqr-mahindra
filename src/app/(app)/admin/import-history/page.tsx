import { getSession } from '@/lib/auth';
import { canManageLegacyImport } from '@/lib/scope';
import { t, getServerLocale } from '@/lib/i18n/server';
import { createNtrImportService } from '@/features/ntr/factory';
import PageHeader from '@/components/shared/layout/PageHeader';
import EmptyState from '@/components/shared/layout/EmptyState';
import ImportSessionHistoryTable from '@/features/ntr/components/ImportSessionHistoryTable';

export const dynamic = 'force-dynamic';

/**
 * Import History (MSEAL Design Framework, ADR-023, Administration nav
 * group). The "View All" destination for the Legacy Import wizard's
 * latest-3 history widget - same underlying `listSessions()` read
 * (`NtrImportService`, unchanged), same row shape
 * (`ImportSessionHistoryTable`, shared with the wizard), just the full
 * list instead of 3. Read-only - importing itself still only happens
 * through the Legacy Import wizard.
 *
 * Super Administrator only, same gate as Legacy Import itself (this is an
 * import-operations view, not general reporting) - both the server-side
 * check here and the nav entry's visibility use the identical
 * `canManageLegacyImport` predicate.
 */
export default async function ImportHistoryPage() {
  const session = await getSession();
  if (!session) return null;

  if (!canManageLegacyImport(session.role)) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-6 text-red-700">
        <p>{t('validation.unauthorizedLegacyImport')}</p>
      </div>
    );
  }

  const locale = getServerLocale();
  const sessions = await createNtrImportService().listSessions();

  return (
    <div className="space-y-4">
      <PageHeader title={t('nav.adminImportHistory')} titleClassName="text-xl font-bold text-brand-dark" className="block" />
      {sessions.length === 0 ? (
        <EmptyState
          title={t('common.notFound')}
          reason="No import has been run yet."
          nextStep="Run a Legacy Import from Machines > Legacy Import to see history here."
        />
      ) : (
        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
          <ImportSessionHistoryTable sessions={sessions} locale={locale} t={t} />
        </div>
      )}
    </div>
  );
}
