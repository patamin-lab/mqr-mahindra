'use client';

/**
 * The ONE shared attachment upload tile - label + required/optional
 * marker + preview + file input - used by every module's create/edit
 * form (NTR, PM, and any future one) instead of a hand-duplicated inline
 * tile per module. Previously NTR (`ntr-search.tsx`) and PM
 * (`maintenance-form.tsx`/`maintenance-search.tsx`) each had their own
 * copy, with PM's actually diverging in behavior (`object-cover`, fixed
 * `h-24` height - cropped a portrait photo) from NTR's (`object-contain`,
 * `aspect-video` - never crops). This component standardizes on NTR's
 * correct behavior everywhere.
 *
 * Fixed 16:9 preview frame, `object-contain` (never crop or stretch) -
 * the entire photo is always visible, landscape-framed, whatever its
 * original aspect ratio. EXIF auto-rotation happens once, at upload time
 * (`processImageForUpload()`, called by the caller before invoking
 * `uploadAttachment()`) - by the time a photo has a `url` here, it is
 * already right-side-up, so this component only needs to render it, not
 * re-detect orientation.
 */
const PHOTO_PREVIEW_CLASS = 'aspect-video w-full rounded bg-gray-100 object-contain';

export interface AttachmentPhotoTileProps {
  label: string;
  required: boolean;
  url: string | null;
  uploading: boolean;
  disabled: boolean;
  noPhotoYetText: string;
  uploadingText: string;
  optionalText: string;
  onSelect: (file: File) => void;
}

/** Module-level usage matters: mount this component once per slot (not
 *  recreate it inline in a nested closure) so its `<input type="file">`
 *  isn't remounted - and its pending selection lost - on every keystroke
 *  elsewhere in the parent form. */
export default function AttachmentPhotoTile({
  label,
  required,
  url,
  uploading,
  disabled,
  noPhotoYetText,
  uploadingText,
  optionalText,
  onSelect,
}: AttachmentPhotoTileProps) {
  return (
    <div className="rounded border border-dashed border-gray-300 p-3 text-center">
      <p className="mb-2 text-xs text-gray-500">
        {label} {required ? <span className="text-brand-red">*</span> : `(${optionalText})`}
      </p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} className={`mb-2 ${PHOTO_PREVIEW_CLASS}`} />
      ) : (
        <div className={`mb-2 flex items-center justify-center text-xs text-gray-400 ${PHOTO_PREVIEW_CLASS}`}>{noPhotoYetText}</div>
      )}
      <input
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
        }}
        className="w-full text-xs"
      />
      {uploading && <p className="mt-1 text-xs text-gray-400">{uploadingText}</p>}
    </div>
  );
}
