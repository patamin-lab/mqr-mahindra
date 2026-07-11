import { formatDateTimeLocalized } from '@/lib/thaiDate';
import type { NtrImportSession } from '../types';
import type { Locale, TranslationVars } from '@/lib/i18n/types';

/**
 * Import Session History table (MSEAL Design Framework, ADR-023,
 * DASHBOARD_GUIDELINE.md's "Recent Imports: latest 3, View All" pattern).
 * Extracted verbatim from `legacy-import-tool.tsx`'s previously inline
 * history table so the same row shape backs both that wizard's "latest 3"
 * view and `/admin/import-history`'s full history - one table
 * implementation, not two independently maintained copies.
 */
export interface ImportSessionHistoryTableProps {
  sessions: NtrImportSession[];
  locale: Locale;
  t: (key: string, vars?: TranslationVars) => string;
}

export default function ImportSessionHistoryTable({ sessions, locale, t }: ImportSessionHistoryTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead className="bg-gray-50 text-left uppercase text-gray-500">
          <tr>
            <th className="px-2 py-2">{t('ntr.filename')}</th>
            <th className="px-2 py-2">{t('ntr.moduleColumn')}</th>
            <th className="px-2 py-2">{t('ntr.importer')}</th>
            <th className="px-2 py-2">{t('ntr.startedAt')}</th>
            <th className="px-2 py-2">{t('ntr.completedAt')}</th>
            <th className="px-2 py-2">{t('ntr.validCount')}</th>
            <th className="px-2 py-2">{t('ntr.skippedCount')}</th>
            <th className="px-2 py-2">{t('ntr.failedCount')}</th>
            <th className="px-2 py-2">{t('common.status')}</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id} className="border-t border-gray-100">
              <td className="px-2 py-2">{s.filename}</td>
              <td className="px-2 py-2">NTR</td>
              <td className="px-2 py-2">{s.importer}</td>
              <td className="px-2 py-2 whitespace-nowrap">{formatDateTimeLocalized(s.started_at, locale)}</td>
              <td className="px-2 py-2 whitespace-nowrap">{s.completed_at ? formatDateTimeLocalized(s.completed_at, locale) : '-'}</td>
              <td className="px-2 py-2">{s.valid_count}</td>
              <td className="px-2 py-2">{s.skipped_count}</td>
              <td className="px-2 py-2">{s.failed_count}</td>
              <td className="px-2 py-2">{t(`ntr.importStatus_${s.status.replace(/\s/g, '')}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
