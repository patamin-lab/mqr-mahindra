/**
 * Shared GPS location shape - reusable across any future module that
 * needs a lat/lng + accuracy + Google Maps link (not PM-Record-specific).
 */
export interface GpsLocation {
  latitude: number | null;
  longitude: number | null;
  /** Accuracy radius in meters, from the browser Geolocation API (not
   *  available for a manually-searched/dragged point). */
  accuracy: number | null;
  googleMapsUrl: string | null;
}

export interface ReverseGeocodeResult {
  village: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
}

export function googleMapsUrlFor(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

/** Accuracy above this radius (meters) is flagged as a low-signal warning -
 *  never blocks Save, GPS is optional. */
export const LOW_ACCURACY_THRESHOLD_M = 30;

export function isValidLatLng(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Recognizes a plain "lat,lng" pair or a Google Maps URL (either shape:
 * `?q=lat,lng` or `/@lat,lng,zoom`) pasted directly into the location
 * search box, per spec ("Allow search by ... Latitude / Longitude /
 * Google Maps URL"). Returns null if the text doesn't match either shape,
 * so the caller falls back to a normal place-name search.
 */
export function parseDirectCoordinates(query: string): { lat: number; lng: number } | null {
  const trimmed = query.trim();

  const plainMatch = trimmed.match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (plainMatch) {
    const lat = parseFloat(plainMatch[1]);
    const lng = parseFloat(plainMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const urlMatch = trimmed.match(/[@?&]q?=?(-?\d{1,3}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/);
  if (urlMatch) {
    const lat = parseFloat(urlMatch[1]);
    const lng = parseFloat(urlMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}
