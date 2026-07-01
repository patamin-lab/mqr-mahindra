/**
 * EXIF Reader (reusable) - extracts GPS coordinates embedded in a photo's
 * EXIF metadata, if present. Uses `exifr` (small, zero-dependency, client-
 * side only, no API key/billing) rather than hand-rolling binary EXIF/TIFF
 * IFD parsing, which would be far more error-prone for a one-off feature.
 */
import { gps } from 'exifr';

export async function readGpsFromImageFile(file: File): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const result = await gps(file);
    if (!result || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') return null;
    return { latitude: result.latitude, longitude: result.longitude };
  } catch {
    return null;
  }
}
