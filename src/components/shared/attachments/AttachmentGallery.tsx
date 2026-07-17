'use client';

/**
 * Shared photo/attachment grid (docs/standards/UI_COMPONENT_STANDARD.md
 * "Attachment Gallery" consolidation). Extracted from the two independent
 * implementations found in the audit - MQR detail's per-category grid
 * (clickable tiles, opens the original in a new tab, a caption under each
 * photo) and PM detail's fixed 3-slot grid (bare, non-clickable images).
 * `linkable` preserves that behavioral difference exactly rather than
 * unifying it - PM's images were never clickable before this extraction,
 * and adding that now would be a new interactive affordance, not a pure
 * consolidation.
 *
 * Image Standardization: a `linkable` tile now opens the same in-app
 * lightbox (Fit Width/Fit Height/Zoom/Full Screen/Temporary Rotate)
 * `AttachmentViewer` already has, instead of a bare `target="_blank"` new
 * tab - reuses `ImagePreview` from that file rather than a second
 * implementation. "Open in a new tab" remains available from inside the
 * lightbox, so no capability is removed, only the default action improved
 * (every module with photos must support a full-screen viewer, not just a
 * browser-native image tab).
 */
import { useState } from 'react';
import { useTranslation } from '@/lib/i18n/LocaleProvider';
import { ImagePreview } from './AttachmentViewer';

export interface AttachmentGalleryItem {
  key: string | number;
  url: string;
  alt: string;
  /** Only rendered when `linkable` is also set - PM's usage never showed
   *  a caption under the tile even where MQR's did. */
  caption?: React.ReactNode;
}

export interface AttachmentGalleryProps {
  items: AttachmentGalleryItem[];
  /** Opens the shared lightbox on click - MQR's grid does this, PM's does
   *  not. */
  linkable?: boolean;
  className?: string;
  imgClassName?: string;
}

const DEFAULT_GRID = 'grid grid-cols-2 sm:grid-cols-4 gap-3';
const DEFAULT_IMG = 'rounded border border-gray-200 aspect-square object-cover';

export default function AttachmentGallery({ items, linkable = false, className, imgClassName }: AttachmentGalleryProps) {
  const { t } = useTranslation();
  const [previewing, setPreviewing] = useState<AttachmentGalleryItem | null>(null);

  return (
    <div className={className ?? DEFAULT_GRID}>
      {items.map((item) => {
        // eslint-disable-next-line @next/next/no-img-element
        const img = <img src={item.url} alt={item.alt} className={imgClassName ?? DEFAULT_IMG} />;
        return linkable ? (
          <button key={item.key} type="button" onClick={() => setPreviewing(item)} className="block text-left">
            {img}
            {item.caption !== undefined && <div className="mt-1 truncate text-xs text-gray-500">{item.caption}</div>}
          </button>
        ) : (
          <div key={item.key}>{img}</div>
        );
      })}

      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewing(null)}>
          <div className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <ImagePreview key={previewing.key} url={previewing.url} filename={previewing.alt} t={t} />
            <div className="mt-2 flex gap-2">
              <a
                href={previewing.url}
                target="_blank"
                rel="noreferrer"
                className="flex-1 rounded bg-white/10 py-2 text-center text-sm text-white hover:bg-white/20"
              >
                {t('attachmentViewer.open')}
              </a>
              <button type="button" onClick={() => setPreviewing(null)} className="flex-1 rounded bg-white/10 py-2 text-sm text-white hover:bg-white/20">
                {t('attachmentViewer.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
