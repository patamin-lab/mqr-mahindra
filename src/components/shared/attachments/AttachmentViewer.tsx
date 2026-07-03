'use client';

/**
 * Reusable attachment viewer (Phase 5B.1) - the display-side counterpart
 * to `uploadAttachment.ts`. Every module (MQR, PM, PDI, NTR, Machine 360)
 * renders its attachments through this component instead of its own
 * per-module `<img>`/`<a>` markup, given only what `AttachmentService`
 * already resolved (`url`/`mimeType`/`filename`) - never a storage
 * provider, bucket, or signed-URL detail itself.
 */
import { useState } from 'react';
import { useTranslation } from '@/lib/i18n/LocaleProvider';

export interface AttachmentViewerItem {
  id: string;
  filename: string;
  mimeType: string;
  url: string | null;
}

export interface AttachmentViewerProps {
  items: AttachmentViewerItem[];
  onDelete?: (id: string) => void;
  className?: string;
  emptyMessage?: string;
}

type Kind = 'image' | 'pdf' | 'video' | 'audio' | 'excel' | 'other';

function kindOf(mimeType: string): Kind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'excel';
  return 'other';
}

const KIND_ICON: Record<Exclude<Kind, 'image'>, string> = {
  pdf: '📄',
  video: '🎬',
  audio: '🎵',
  excel: '📊',
  other: '📎',
};

export default function AttachmentViewer({ items, onDelete, className, emptyMessage }: AttachmentViewerProps) {
  const { t } = useTranslation();
  const [previewing, setPreviewing] = useState<AttachmentViewerItem | null>(null);

  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-gray-400">{emptyMessage ?? t('attachmentViewer.noAttachments')}</p>;
  }

  return (
    <div className={className ?? 'grid grid-cols-2 gap-3 sm:grid-cols-4'}>
      {items.map((item) => {
        const kind = kindOf(item.mimeType);
        return (
          <div key={item.id} className="flex flex-col gap-1 rounded border border-gray-200 p-2">
            <button
              type="button"
              onClick={() => item.url && setPreviewing(item)}
              disabled={!item.url}
              className="block disabled:cursor-not-allowed disabled:opacity-50"
            >
              {kind === 'image' && item.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.url} alt={item.filename} className="aspect-square w-full rounded object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded bg-gray-50 text-3xl">
                  {item.url ? KIND_ICON[kind as Exclude<Kind, 'image'>] ?? KIND_ICON.other : '⏳'}
                </div>
              )}
            </button>
            <div className="truncate text-xs text-gray-500" title={item.filename}>
              {item.url ? item.filename : t('attachmentViewer.unavailable')}
            </div>
            {item.url && (
              <div className="flex gap-2 text-xs">
                <a href={item.url} target="_blank" rel="noreferrer" className="text-brand-red hover:underline">
                  {t('attachmentViewer.open')}
                </a>
                <a href={item.url} download={item.filename} className="text-brand-red hover:underline">
                  {t('attachmentViewer.download')}
                </a>
                {onDelete && (
                  <button type="button" onClick={() => onDelete(item.id)} className="text-gray-400 hover:text-red-600">
                    {t('attachmentViewer.delete')}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {previewing && previewing.url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewing(null)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <PreviewBody item={previewing} t={t} />
            <button type="button" onClick={() => setPreviewing(null)} className="mt-2 w-full rounded bg-white/10 py-2 text-white">
              {t('attachmentViewer.close')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewBody({ item, t }: { item: AttachmentViewerItem; t: (key: string) => string }) {
  const kind = kindOf(item.mimeType);
  if (!item.url) return null;
  switch (kind) {
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={item.url} alt={item.filename} className="max-h-[80vh] w-full object-contain" />;
    case 'video':
      return <video src={item.url} controls className="max-h-[80vh] w-full" />;
    case 'audio':
      return <audio src={item.url} controls className="w-full" />;
    case 'pdf':
      return <iframe src={item.url} className="h-[80vh] w-full rounded bg-white" title={item.filename} />;
    case 'excel':
    case 'other':
    default:
      return (
        <div className="rounded bg-white p-6 text-center">
          <p className="mb-3">{kind === 'excel' ? t('attachmentViewer.excelPreviewUnsupported') : item.filename}</p>
          <a href={item.url} download={item.filename} className="rounded bg-brand-red px-4 py-2 text-white">
            {t('attachmentViewer.download')}
          </a>
        </div>
      );
  }
}
