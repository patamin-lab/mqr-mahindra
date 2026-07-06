/**
 * Client-side photo standardization (NTR Attachment Requirements v2) -
 * every photo upload goes through this before `uploadAttachment()` so
 * previews/PDF pages never have to deal with mixed orientations, huge
 * source dimensions, or non-JPEG formats.
 *
 * `createImageBitmap(file, { imageOrientation: 'from-image' })` reads the
 * file's EXIF `Orientation` tag and returns an already-upright bitmap -
 * this is the browser's own EXIF handling, not hand-rolled matrix math
 * (which is easy to get subtly wrong for the mirrored orientation values
 * 2/4/5/7). Any browser too old to support the option (or a corrupt/
 * unreadable file) falls back to `<img>` decoding with no orientation
 * correction - fail-open, never blocks the upload.
 */
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1080;
const JPEG_QUALITY = 0.85;

const HEIC_EXTENSIONS = new Set(['heic', 'heif']);
const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);

function isHeic(file: File): boolean {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return HEIC_EXTENSIONS.has(ext) || HEIC_MIME_TYPES.has(file.type.toLowerCase());
}

function fitDimensions(width: number, height: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function decodeUpright(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('image decode failed'));
      };
      img.src = url;
    });
  }
}

function sourceSize(source: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return 'naturalWidth' in source ? { width: source.naturalWidth, height: source.naturalHeight } : { width: source.width, height: source.height };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Normalizes one photo upload: EXIF-upright, forced landscape (a portrait
 * result is rotated 90° so every stored photo is landscape - matching the
 * fixed 16:9 preview/PDF frame with minimal letterboxing), resized to fit
 * within 1920x1080 (never upscaled past the original), re-encoded as JPEG
 * at ~85% quality.
 *
 * Non-image files (video) and HEIC/HEIF (already handled server-side by
 * `/api/attachments`'s `heic-convert` step) pass through untouched. Any
 * processing failure returns the original file rather than blocking the
 * upload.
 */
export async function processImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || isHeic(file)) return file;

  try {
    const source = await decodeUpright(file);
    const { width: srcWidth, height: srcHeight } = sourceSize(source);
    const isPortrait = srcHeight > srcWidth;
    const rotatedWidth = isPortrait ? srcHeight : srcWidth;
    const rotatedHeight = isPortrait ? srcWidth : srcHeight;
    const { width, height } = fitDimensions(rotatedWidth, rotatedHeight, MAX_WIDTH, MAX_HEIGHT);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    if (isPortrait) {
      // Rotate 90° clockwise into the (now landscape) canvas.
      ctx.translate(width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(source, 0, 0, height, width);
    } else {
      ctx.drawImage(source, 0, 0, width, height);
    }
    if ('close' in source) source.close();

    const blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
    if (!blob) return file;
    const newName = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
