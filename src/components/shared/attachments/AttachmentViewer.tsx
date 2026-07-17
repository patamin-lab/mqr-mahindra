'use client';

/**
 * Reusable attachment viewer (Phase 5B.1) - the display-side counterpart
 * to `uploadAttachment.ts`. Every module (MQR, PM, PDI, NTR, Machine 360)
 * renders its attachments through this component instead of its own
 * per-module `<img>`/`<a>` markup, given only what `AttachmentService`
 * already resolved (`url`/`mimeType`/`filename`) - never a storage
 * provider, bucket, or signed-URL detail itself.
 *
 * Image Standardization (Document Viewer): the full-screen image preview
 * supports Fit Width, Fit Height, Zoom, Full Screen, and Temporary Rotate
 * Left/Right - all local component state (CSS `transform`/sizing only),
 * reset every time a different attachment is opened (`key={item.id}` on
 * `ImagePreview` below) and never persisted - this never modifies the
 * stored file, only how it's momentarily displayed.
 */
import { useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, RotateCw, Maximize2, Minimize2, StretchHorizontal, StretchVertical } from 'lucide-react';
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
            <PreviewBody key={previewing.id} item={previewing} t={t} />
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
      return <ImagePreview url={item.url} filename={item.filename} t={t} />;
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

type FitMode = 'contain' | 'width' | 'height';
const ZOOM_STEP = 0.25;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 4;

/** Exported so `AttachmentGallery` (the simpler photo-grid component used
 *  by MQR/PM/NTR) can reuse the exact same Fit/Zoom/Rotate/Full-Screen
 *  controls in its own lightbox instead of a second implementation - see
 *  that file's `linkable` lightbox. */
export function ImagePreview({ url, filename, t }: { url: string; filename: string; t: (key: string) => string }) {
  const [fitMode, setFitMode] = useState<FitMode>('contain');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onFullscreenChange() {
      setFullScreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  async function toggleFullScreen() {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    } else {
      await containerRef.current.requestFullscreen?.().catch(() => undefined);
    }
  }

  const imgClassName =
    fitMode === 'width'
      ? 'w-full h-auto'
      : fitMode === 'height'
        ? 'h-[80vh] w-auto max-w-none'
        : 'max-h-[80vh] w-full object-contain';

  return (
    <div ref={containerRef} className={`flex flex-col gap-2 ${fullScreen ? 'h-screen w-screen items-center justify-center bg-black' : ''}`}>
      <div className="flex flex-wrap items-center justify-center gap-1 rounded bg-white/10 p-1">
        <ViewerButton active={fitMode === 'width'} label={t('attachmentViewer.fitWidth')} icon={StretchHorizontal} onClick={() => setFitMode('width')} />
        <ViewerButton active={fitMode === 'height'} label={t('attachmentViewer.fitHeight')} icon={StretchVertical} onClick={() => setFitMode('height')} />
        <ViewerButton label={t('attachmentViewer.zoomOut')} icon={ZoomOut} onClick={() => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)))} />
        <span className="w-12 text-center text-xs text-white">{Math.round(zoom * 100)}%</span>
        <ViewerButton label={t('attachmentViewer.zoomIn')} icon={ZoomIn} onClick={() => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)))} />
        <ViewerButton label={t('attachmentViewer.rotateLeft')} icon={RotateCcw} onClick={() => setRotation((r) => (r - 90 + 360) % 360)} />
        <ViewerButton label={t('attachmentViewer.rotateRight')} icon={RotateCw} onClick={() => setRotation((r) => (r + 90) % 360)} />
        <ViewerButton
          label={fullScreen ? t('attachmentViewer.exitFullScreen') : t('attachmentViewer.fullScreen')}
          icon={fullScreen ? Minimize2 : Maximize2}
          onClick={toggleFullScreen}
        />
      </div>
      <div className={fullScreen ? 'flex flex-1 items-center justify-center overflow-auto' : 'overflow-auto'}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={filename}
          className={imgClassName}
          style={{ transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 150ms ease' }}
        />
      </div>
    </div>
  );
}

function ViewerButton({
  label,
  icon: Icon,
  onClick,
  active,
}: {
  label: string;
  icon: typeof ZoomIn;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition-colors hover:bg-white/20 ${active ? 'bg-white/25' : ''}`}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
