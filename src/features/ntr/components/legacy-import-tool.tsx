'use client';

/**
 * NTR Legacy Import — Import Wizard (Download Template -> Upload ->
 * Preview & Validation -> Confirm Import -> Import Complete), built on the
 * Universal Import Framework shell (`src/shared/import/components/
 * ImportWizard.tsx`). Nothing is written until Step 4's explicit
 * confirmation (see `NtrImportService.preview()`/`commit()`). Import
 * History and the Archive Queue are shown below the wizard at all times,
 * not gated by step, since they're audit/ops views, not part of any one
 * import run.
 */
import { useEffect, useState } from 'react';
import { fetchJson, FetchJsonError } from '@/lib/fetchJson';
import { swalErrorToast, swalLoading, swalClose, swalSuccessToast } from '@/lib/swal';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { formatDateTimeLocalized } from '@/lib/thaiDate';
import ImportWizard from '@/shared/import/components/ImportWizard';
import type { NtrImportPreview, NtrImportSession } from '../types';

interface FileInfo {
  filename: string;
  fileSize: number;
  rowCount: number;
  detectedTemplateVersion: string | null;
  expectedTemplateVersion: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Client-side CSV download - no server round-trip needed, the data is
 *  already in hand from the preview/commit response. */
function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [headers, ...rows].map((row) => row.map((cell) => escape(String(cell ?? ''))).join(','));
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LegacyImportTool() {
  const { t, locale } = useTranslation();
  const [wizardStep, setWizardStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [preview, setPreview] = useState<NtrImportPreview | null>(null);
  const [commitResult, setCommitResult] = useState<NtrImportSession | null>(null);
  const [sessions, setSessions] = useState<NtrImportSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [archiveQueue, setArchiveQueue] = useState<NtrImportSession[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

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

  async function loadArchiveQueue() {
    setLoadingQueue(true);
    try {
      const json = await fetchJson<{ ok: boolean; data: NtrImportSession[] }>('/api/ntr/import/archive');
      setArchiveQueue(json.data ?? []);
    } catch {
      setArchiveQueue([]);
    } finally {
      setLoadingQueue(false);
    }
  }

  useEffect(() => {
    loadSessions();
    loadArchiveQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function showError(err: unknown) {
    if (err instanceof FetchJsonError && err.message === 'SESSION_EXPIRED') {
      await swalErrorToast(t('validation.sessionExpired'));
    } else {
      await swalErrorToast(err instanceof Error ? err.message : t('common.error'));
    }
  }

  function resetWizard() {
    setWizardStep(1);
    setFile(null);
    setFileInfo(null);
    setSessionId(null);
    setPreview(null);
    setCommitResult(null);
  }

  function pickFile(picked: File | null) {
    setFile(picked);
    setFileInfo(null);
    setPreview(null);
    setSessionId(null);
  }

  async function onUploadAndValidate() {
    if (!file) {
      await swalErrorToast(t('validation.importFileRequired'));
      return;
    }
    setUploading(true);
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
      setFileInfo(json.data.fileInfo);
      await loadSessions();
      setWizardStep(3);
    } catch (err) {
      swalClose();
      await showError(err);
    } finally {
      setUploading(false);
    }
  }

  async function onConfirmImport() {
    if (!sessionId) return;
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
      setCommitResult(result.data);
      setWizardStep(5);
      await Promise.all([loadSessions(), loadArchiveQueue()]);
    } catch (err) {
      swalClose();
      await showError(err);
    } finally {
      setCommitting(false);
    }
  }

  async function onProcessQueue(sessionIdToRetry?: string) {
    if (sessionIdToRetry) setRetryingId(sessionIdToRetry);
    else setProcessingQueue(true);
    try {
      await fetchJson('/api/ntr/import/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(sessionIdToRetry ? { sessionId: sessionIdToRetry } : {}),
      });
      swalSuccessToast(t('ntr.archiveQueueProcessedToast'));
      await Promise.all([loadArchiveQueue(), loadSessions()]);
    } catch (err) {
      await showError(err);
    } finally {
      setProcessingQueue(false);
      setRetryingId(null);
    }
  }

  function downloadImportResult() {
    if (!preview) return;
    downloadCsv(
      `ntr-import-result-${sessionId ?? 'session'}.csv`,
      ['Row', 'Serial', 'Outcome', 'Reason'],
      preview.rows.map((r) => [r.row, r.serial ?? '', r.outcome, r.reason ?? ''])
    );
  }

  function downloadErrorReport() {
    if (!preview) return;
    const errorRows = preview.rows.filter((r) => r.outcome === 'failed');
    downloadCsv(
      `ntr-import-errors-${sessionId ?? 'session'}.csv`,
      ['Row', 'Serial', 'Reason'],
      errorRows.map((r) => [r.row, r.serial ?? '', r.reason ?? ''])
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <ImportWizard currentStep={wizardStep} title={t('nav.legacyImport')}>
        {wizardStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-600">{t('ntr.wizardStep1Title')}</h2>
            <p className="text-sm text-gray-500">{t('ntr.wizardStep1Body')}</p>
            <div className="flex gap-3">
              <a
                href="/api/ntr/import/template"
                className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              >
                {t('ntr.downloadTemplateButton')}
              </a>
              <button
                type="button"
                onClick={() => setWizardStep(2)}
                className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}

        {wizardStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-600">{t('ntr.wizardStep2Title')}</h2>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                pickFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={`rounded border-2 border-dashed p-8 text-center text-sm ${isDragging ? 'border-brand-red bg-red-50' : 'border-gray-300 bg-gray-50'}`}
            >
              <p className="mb-3 text-gray-500">{t('ntr.dragDropHint')}</p>
              <input
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
                className="mx-auto w-full max-w-xs text-sm"
              />
              {file && (
                <p className="mt-3 text-xs text-gray-600">
                  {file.name} · {formatBytes(file.size)}
                </p>
              )}
            </div>
            <div className="flex justify-between">
              <button type="button" onClick={() => setWizardStep(1)} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
                {t('common.back')}
              </button>
              <button
                type="button"
                onClick={onUploadAndValidate}
                disabled={!file || uploading}
                className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {uploading ? t('common.loading') : t('ntr.previewButton')}
              </button>
            </div>
          </div>
        )}

        {wizardStep === 3 && preview && fileInfo && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-600">{t('ntr.previewTitle')}</h2>
            <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 sm:grid-cols-4">
              <p>
                {t('ntr.filename')}: <span className="text-gray-800">{fileInfo.filename}</span>
              </p>
              <p>
                {t('ntr.fileSize')}: <span className="text-gray-800">{formatBytes(fileInfo.fileSize)}</span>
              </p>
              <p>
                {t('ntr.rowCount')}: <span className="text-gray-800">{fileInfo.rowCount}</span>
              </p>
              <p>
                {t('ntr.detectedTemplateVersion')}:{' '}
                <span className="text-gray-800">{fileInfo.detectedTemplateVersion ?? t('ntr.templateVersionUnknown')}</span>
              </p>
            </div>

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

            <details className="rounded border border-gray-100 bg-gray-50 p-3 text-xs">
              <summary className="cursor-pointer font-semibold text-gray-600">{t('ntr.columnMappingTitle')}</summary>
              <div className="mt-2 space-y-2">
                <p>
                  <span className="font-semibold">{t('ntr.mappedColumns')}:</span>{' '}
                  {preview.columnMapping.mapped.map((m) => `${m.displayLabel} ← ${m.header}`).join(', ') || '-'}
                </p>
                {preview.columnMapping.ignoredColumns.length > 0 && (
                  <p>
                    <span className="font-semibold">{t('ntr.ignoredColumns')}:</span> {preview.columnMapping.ignoredColumns.join(', ')}
                  </p>
                )}
                {preview.columnMapping.unknownColumns.length > 0 && (
                  <p>
                    <span className="font-semibold">{t('ntr.unknownColumns')}:</span> {preview.columnMapping.unknownColumns.join(', ')}
                  </p>
                )}
                {preview.columnMapping.missingRequiredColumns.length > 0 && (
                  <p className="text-red-600">
                    <span className="font-semibold">{t('ntr.missingRequiredColumns')}:</span>{' '}
                    {preview.columnMapping.missingRequiredColumns.join(', ')}
                  </p>
                )}
              </div>
            </details>

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

            <div className="flex justify-between">
              <button type="button" onClick={() => setWizardStep(2)} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
                {t('common.back')}
              </button>
              <button
                type="button"
                onClick={() => setWizardStep(4)}
                disabled={preview.validCount === 0}
                className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}

        {wizardStep === 4 && preview && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-600">{t('ntr.confirmImportTitle')}</h2>
            <p className="text-sm text-gray-700">{t('ntr.confirmImportBody', { count: preview.validCount })}</p>
            <div className="flex justify-between">
              <button type="button" onClick={() => setWizardStep(3)} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={onConfirmImport}
                disabled={committing}
                className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {committing ? t('common.saving') : t('ntr.importButton')}
              </button>
            </div>
          </div>
        )}

        {wizardStep === 5 && commitResult && preview && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-600">{t('ntr.wizardStep5Title')}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded border border-green-100 bg-green-50 p-3 text-center">
                <p className="text-xs text-green-700">{t('ntr.validCount')}</p>
                <p className="text-lg font-bold text-green-700">{commitResult.valid_count}</p>
              </div>
              <div className="rounded border border-amber-100 bg-amber-50 p-3 text-center">
                <p className="text-xs text-amber-700">{t('ntr.duplicateCount')}</p>
                <p className="text-lg font-bold text-amber-700">{commitResult.duplicate_count}</p>
              </div>
              <div className="rounded border border-gray-100 bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">{t('ntr.skippedCount')}</p>
                <p className="text-lg font-bold text-gray-600">{commitResult.skipped_count}</p>
              </div>
              <div className="rounded border border-red-100 bg-red-50 p-3 text-center">
                <p className="text-xs text-red-700">{t('ntr.failedCount')}</p>
                <p className="text-lg font-bold text-red-700">{commitResult.failed_count}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              {t('common.status')}: {t(`ntr.importStatus_${commitResult.status.replace(/\s/g, '')}`)}
            </p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={downloadImportResult} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
                {t('ntr.downloadImportResultButton')}
              </button>
              {commitResult.failed_count > 0 && (
                <button type="button" onClick={downloadErrorReport} className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
                  {t('ntr.downloadErrorReportButton')}
                </button>
              )}
              <button type="button" onClick={resetWizard} className="rounded bg-brand-red px-4 py-2 text-sm text-white hover:bg-brand-dark">
                {t('ntr.startNewImportButton')}
              </button>
            </div>
          </div>
        )}
      </ImportWizard>

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
        )}
      </div>

      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-600">{t('ntr.archiveQueueTitle')}</h2>
          <button
            type="button"
            onClick={() => onProcessQueue()}
            disabled={processingQueue || archiveQueue.length === 0}
            className="rounded border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 disabled:opacity-50"
          >
            {processingQueue ? t('common.loading') : t('ntr.processQueueButton')}
          </button>
        </div>
        {loadingQueue ? (
          <p className="text-sm text-gray-400">{t('common.loading')}</p>
        ) : archiveQueue.length === 0 ? (
          <p className="text-sm text-gray-400">{t('ntr.archiveQueueEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-left uppercase text-gray-500">
                <tr>
                  <th className="px-2 py-2">{t('ntr.filename')}</th>
                  <th className="px-2 py-2">{t('common.status')}</th>
                  <th className="px-2 py-2">{t('ntr.archiveAttempts')}</th>
                  <th className="px-2 py-2">{t('ntr.lastArchiveAttempt')}</th>
                  <th className="px-2 py-2">{t('ntr.archiveErrorLabel')}</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {archiveQueue.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="px-2 py-2">{s.filename}</td>
                    <td className="px-2 py-2">{t(`ntr.importStatus_${s.status.replace(/\s/g, '')}`)}</td>
                    <td className="px-2 py-2">{s.archive_attempts}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {s.last_archive_attempt_at ? formatDateTimeLocalized(s.last_archive_attempt_at, locale) : '-'}
                    </td>
                    <td className="px-2 py-2 text-red-600">{s.archive_error ?? '-'}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onProcessQueue(s.id)}
                        disabled={retryingId === s.id || processingQueue}
                        className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
                      >
                        {retryingId === s.id ? t('common.loading') : t('ntr.retryArchiveButton')}
                      </button>
                    </td>
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
