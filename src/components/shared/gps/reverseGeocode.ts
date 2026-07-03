import type { ReverseGeocodeResult } from './types';

/**
 * Reverse Geocoder (display-only, reusable) - resolves lat/lng to Thai
 * administrative divisions via Nominatim (OpenStreetMap), the same free,
 * no-API-key geocoding service already used by the QIR report form's
 * location search (see src/app/(app)/report/location-picker.tsx). Never
 * stored in the database - callers display it, nothing more.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=th&zoom=18`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const address = json?.address ?? {};
    return {
      village: address.village ?? address.hamlet ?? null,
      subdistrict: address.suburb ?? address.subdistrict ?? address.quarter ?? null,
      district: address.city_district ?? address.county ?? address.district ?? null,
      province: address.state ?? address.province ?? null,
    };
  } catch {
    return null;
  }
}

export interface ForwardGeocodeResult {
  display_name: string;
  lat: string;
  lon: string;
}

/** Forward search by place name (village/subdistrict/district/province, or
 *  any free-text place name) - same Nominatim endpoint the QIR location
 *  picker already uses, scoped to Thailand. */
export async function searchThaiPlace(query: string): Promise<ForwardGeocodeResult[]> {
  if (!query.trim()) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=th&accept-language=th&q=${encodeURIComponent(
    query.trim()
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('ค้นหาไม่สำเร็จ');
  return (await res.json()) as ForwardGeocodeResult[];
}
