/**
 * MASP Platform — Address Platform: address hierarchy validation
 * (Province -> District -> Subdistrict -> Postal Code), against
 * `thaiAddressData.ts`. Originally NTR-only; promoted to a shared
 * platform service - any module with a Thai address field validates
 * through this, never a second copy.
 *
 * Callers decide whether an address is required at all (this function
 * always accepts a fully-blank input) - what it never does is silently
 * accept an internally inconsistent combination (e.g. a real district
 * that belongs to a different province than the one given) - see
 * docs/import/NTR_HISTORICAL_IMPORT.md's worked example.
 */
import { findDistrict, findProvince, findSubdistrict } from './thaiAddressData';

export interface AddressValidationInput {
  province: string | null;
  district: string | null;
  subdistrict: string | null;
  postalCode: string | null;
}

export type AddressValidationResult = { ok: true } | { ok: false; reason: string };

/** Top-down: Province standing alone is always fine. District requires a
 *  known Province to check membership against (an ambiguous "which
 *  province is this district in" can't be silently guessed - see the
 *  module doc comment and the milestone's own "never silently guess
 *  unmatched values"). Subdistrict requires a known District the same
 *  way. Postal Code is checked against whichever subdistrict was
 *  resolved. */
export function validateThaiAddress(input: AddressValidationInput): AddressValidationResult {
  const province = input.province?.trim() || null;
  const district = input.district?.trim() || null;
  const subdistrict = input.subdistrict?.trim() || null;
  const postalCode = input.postalCode?.trim() || null;

  if (!province && !district && !subdistrict && !postalCode) return { ok: true };

  let resolvedProvinceId: string | null = null;
  if (province) {
    const found = findProvince(province);
    // "Invalid", not "Unknown" - `Unknown \w+ "..."` is a generic pattern
    // `ImportErrorFormatter.ts` already rewrites for a different,
    // canonical-key-based message shape (`Unknown dealer_id "D9"`); this
    // message would otherwise collide with it and get silently rewritten
    // into a less specific "Province column contains an invalid value"
    // message - a real bug found via live UAT, fixed by simply not
    // matching that pattern rather than changing the shared formatter.
    if (!found) return { ok: false, reason: `Invalid Province "${province}" - not a recognized Thailand province` };
    resolvedProvinceId = found.provinceId;
  }

  let resolvedDistrictId: string | null = null;
  if (district) {
    if (!resolvedProvinceId) return { ok: false, reason: 'Province is required when District is provided' };
    const found = findDistrict(district, resolvedProvinceId);
    if (!found) return { ok: false, reason: `District "${district}" does not belong to Province "${province}"` };
    resolvedDistrictId = found.districtId;
  }

  let resolvedSubdistrict = null as ReturnType<typeof findSubdistrict>;
  if (subdistrict) {
    if (!resolvedDistrictId) return { ok: false, reason: 'District is required when Sub-District is provided' };
    resolvedSubdistrict = findSubdistrict(subdistrict, resolvedDistrictId);
    if (!resolvedSubdistrict) return { ok: false, reason: `Sub-District "${subdistrict}" does not belong to District "${district}"` };
  }

  if (postalCode) {
    if (!resolvedSubdistrict) return { ok: false, reason: 'Sub-District is required when Postal Code is provided' };
    if (!resolvedSubdistrict.postalCodes.includes(postalCode)) {
      return { ok: false, reason: `Postal Code "${postalCode}" does not match Sub-District "${subdistrict}"` };
    }
  }

  return { ok: true };
}
