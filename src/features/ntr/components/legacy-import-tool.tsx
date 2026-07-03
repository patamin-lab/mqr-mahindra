'use client';

/**
 * Legacy Import tool - Upload -> Validation -> Preview -> Import ->
 * Summary -> Audit, per spec. Nothing is written until the operator
 * confirms the preview (see NtrImportService.preview()/commit()). Every
 * import session (committed or not) is listed below for the Import Audit
 * requirement.
 */
import { useEffect, useState } from 'react';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalConfirm, swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { formatDateTimeLocalized } from '@/lib/thaiDate';
import type { NtrImportPreview, NtrImportSession } from '../types';

export default function LegacyImportTool() {
  const { t, locale } = useTranslation();
  const [file, setFile] = useState<File | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<NtrImportPreview | null>(null);
  const [sessions, setSessions] = useState<NtrImportSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);

  async function loadSessions() {
    setLoadingSessions(true);
    try {
      const json = await fetchJson<{ ok: boolean; data: NtrImportSession[] }>('/api/ntr/import/sessions');
      setSessions(json.data ?? []);
    } catch {
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function showError(err: unknown) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalErrorToast(t('validation.sessionExpired'));
    } else {
      await swalErrorToast(err instanceof Error ? err.message : t('common.error'));
    }
  }

  async function onPreview() {
    if (!file) {
      await swalErrorToast(t('validation.importFileRequired'));
      return;
    }
    setPreviewing(true);
    swalLoading(t('common.loading'));
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/ntr/import/preview', { method: 'POST', credentials: 'same-origin', body: form });
      const json = await res.json();
      swalClose();
      if (!json.ok) throw new Error(json.error?.message ?? t('common.error'));
      setSessionId(json.data.sessionId);
      setPreview(json.data.preview);
      await loadSessions();
    } catch (err) {
      swalClose();
      await showError(err);
    } finally {
      setPreviewing(false);
    }
  }

  async function onCommit() {
    if (!sessionId) return;
    const confirmed = await swalConfirm(t('ntr.confirmImportBody', { count: preview?.validCount ?? 0 }), {
      title: t('ntr.confirmImportTitle'),
      confirmText: t('ntr.importButton'),
    });
    if (!confirmed) return;

    setCommitting(true);
    swalLoading(t('common.saving'));
    try {
      const result = await fetchJson<{ ok: true; data: NtrImportSession }>('/api/ntr/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ sessionId }),
      });
      swalClose();
      swalSuccessToast(t('ntr.importCompleteToast', { count: result.data.valid_count }));
      setSessionId(null);
      setPreview(null);
      setFile(null);
      await loadSessions();
    } catch (err) {
      swalClose();
      await showError(err);
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold text-brand-dark">{t('nav.legacyImport')}</h1>

      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-gray-600">{t('ntr.uploadFileTitle')}</h2>
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setSessionId(null);
          }}
          disabled={previewing || committing}
          className="w-full text-sm"
        />
        <button
          type="button"
          onClick={onPreview}
          disabled={!file || previewing || committing}
          className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
        >
          {previewing ? t('common.loading') : t('ntr.previewButton')}
        </button>
      </div>

      {preview && (
        <div className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-gray-600">{t('ntr.previewTitle')}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded border border-gray-100 bg-gray-50 p-3 text-center">
              <p className="text-xs text-gray-500">{t('ntr.totalRecords')}</p>
              <p className="text-lg font-bold text-brand-dark">{preview.totalRecords}</p>
            </div>
            <div className="rounded border border-green-100 bg-green-50 p-3 text-center">
              <p className="text-xs text-green-700">{t('ntr.validCount')}</p>
              <p className="text-lg font-bold text-green-700">{preview.validCount}</p>
            </div>
            <div className="rounded border border-amber-100 bg-amber-50 p-3 text-center">
              <p className="text-xs text-amber-700">{t('ntr.duplicateCount')}</p>
              <p className="text-lg font-bold text-amber-700">{preview.duplicateCount}</p>
            </div>
            <div className="rounded border border-gray-100 bg-gray-50 p-3 text-center">
              <p className="text-xs text-gray-500">{t('ntr.skippedCount')}</p>
              <p className="text-lg font-bold text-gray-600">{preview.skippedCount}</p>
            </div>
            <div className="rounded border border-red-100 bg-red-50 p-3 text-center">
              <p className="text-xs text-red-700">{t('ntr.failedCount')}</p>
              <p className="text-lg font-bold text-red-700">{preview.failedCount}</p>
            </div>
          </div>

          {preview.rows.filter((r) => r.outcome !== 'valid').length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-gray-50 text-left uppercase text-gray-500">
                  <tr>
                    <th className="px-2 py-1">{t('ntr.rowNumber')}</th>
                    <th className="px-2 py-1">{t('csv.serial')}</th>
                    <th className="px-2 py-1">{t('ntr.outcome')}</th>
                    <th className="px-2 py-1">{t('ntr.reason')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows
                    .filter((r) => r.outcome !== 'valid')
                    .map((r) => (
                      <tr key={r.row} className="border-t border-gray-100">
                        <td className="px-2 py-1">{r.row}</td>
                        <td className="px-2 py-1">{r.serial ?? '-'}</td>
                        <td className="px-2 py-1">{t(`ntr.outcome_${r.outcome}`)}</td>
                        <td className="px-2 py-1 text-gray-500">{r.reason ?? '-'}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onCommit}
              disabled={committing || preview.validCount === 0}
              className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {committing ? t('common.saving') : t('ntr.importButton')}
            </button>
          </div>
        </div>
      )}

      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-semibold text-gray-600">{t('ntr.sessionHistoryTitle')}</h2>
        {loadingSessions ? (
          <p className="text-sm text-gray-400">{t('common.loading')}</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-gray-400">{t('common.notFound')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-left uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2">{t('ntr.filename')}</th>
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
                    <td className="px-2 py-2">{s.importer}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{formatDateTimeLocalized(s.started_at, locale)}</td>
                    <td className="px-2 py-2 whitespace-nowrap">{s.completed_at ? formatDateTimeLocalized(s.completed_at, locale) : '-'}</td>
                    <td className="px-2 py-2">{s.valid_count}</td>
                    <td className="px-2 py-2">{s.skipped_count}</td>
                    <td className="px-2 py-2">{s.failed_count}</td>
                    <td className="px-2 py-2">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
