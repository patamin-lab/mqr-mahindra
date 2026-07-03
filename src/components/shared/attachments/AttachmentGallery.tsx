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
 */
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
  /** Wraps each tile in `<a href={url} target="_blank">` - MQR's grid
   *  does this, PM's does not. */
  linkable?: boolean;
  className?: string;
  imgClassName?: string;
}

const DEFAULT_GRID = 'grid grid-cols-2 sm:grid-cols-4 gap-3';
const DEFAULT_IMG = 'rounded border border-gray-200 aspect-square object-cover';

export default function AttachmentGallery({ items, linkable = false, className, imgClassName }: AttachmentGalleryProps) {
  return (
    <div className={className ?? DEFAULT_GRID}>
      {items.map((item) => {
        // eslint-disable-next-line @next/next/no-img-element
        const img = <img src={item.url} alt={item.alt} className={imgClassName ?? DEFAULT_IMG} />;
        return linkable ? (
          <a key={item.key} href={item.url} target="_blank" className="block">
            {img}
            {item.caption !== undefined && <div className="text-xs text-gray-500 mt-1 truncate">{item.caption}</div>}
          </a>
        ) : (
          <div key={item.key}>{img}</div>
        );
      })}
    </div>
  );
}
