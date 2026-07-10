/**
 * Thailand Address Resolver (Import Platform v2, ADR-022).
 *
 * A reusable shared service on top of the existing `AddressRepository` -
 * never a second data-access path. `addressValidation.ts`'s
 * `validateThaiAddress()` remains the platform's top-down "is this
 * combination internally consistent" check (Province required before
 * District, District required before Subdistrict); this resolver adds
 * what that function deliberately doesn't do: resolve bottom-up from
 * whichever level is most specific (Subdistrict -> District -> Province,
 * per the brief), recognize common abbreviations/aliases, and return a
 * structured outcome with confidence/resolution-method instead of a bare
 * ok/reason pair - for import pipelines that want to *auto-correct* and
 * continue, not just accept-or-reject.
 *
 * Contract: never throws for a bad address, never stops a batch, never
 * creates Master Data. Two or more equally-valid matches is always
 * `Address Ambiguous`; zero matches is always `Address Not Found` - this
 * resolver does not guess between candidates.
 */
import { AddressRepository, normalizeThaiAddressValue, type ProvinceRef, type DistrictRef, type SubdistrictRef } from './AddressRepository';

const repository = new AddressRepository();

export type ThaiAddressResolutionMethod = 'exact' | 'alias' | 'ambiguous' | 'not_found';

export interface ThaiAddressResolution {
  ok: boolean;
  provinceId: string | null;
  districtId: string | null;
  subdistrictId: string | null;
  normalized: {
    province: string | null;
    district: string | null;
    subdistrict: string | null;
  };
  /** 1.0 = exact match at the level given. Lowered for alias/prefix
   *  resolution or when disambiguation via a secondary hint was needed.
   *  0 for ambiguous/not-found (nothing was actually resolved). */
  confidence: number;
  resolutionMethod: ThaiAddressResolutionMethod;
  /** Set only when `ok` is false - human-readable "Address Ambiguous"/
   *  "Address Not Found" detail, never thrown. */
  reason?: string;
}

/** Well-known Bangkok variants - Bangkok is Thailand's one special-case
 *  province (its sub-units are เขต/แขวง, not อำเภอ/ตำบล, already handled
 *  by `normalizeThaiAddressValue`'s prefix stripping) and is common enough
 *  in real import data to warrant an explicit table rather than relying
 *  on the general ฯ-truncation pattern below, which wouldn't recognize
 *  "Bangkok" or "กทม." at all (neither is a prefix of "กรุงเทพมหานคร"). */
const BANGKOK_ALIASES = new Set(
  ['กทม', 'กทม.', 'กรุงเทพ', 'กรุงเทพฯ', 'bangkok', 'bkk'].map((s) => s.toLowerCase())
);
const BANGKOK_CANONICAL = 'กรุงเทพมหานคร';

function resolveKnownAlias(value: string): string {
  const normalized = normalizeThaiAddressValue(value).toLowerCase();
  return BANGKOK_ALIASES.has(normalized) ? BANGKOK_CANONICAL : value;
}

/** Thai place names are conventionally truncated with ฯ (paiyannoi) once
 *  the reader can infer the rest - "นครศรีฯ" for "นครศรีธรรมราช". Rather
 *  than hardcoding every province's possible abbreviation (guessing),
 *  this strips a trailing ฯ and prefix-matches the remainder against
 *  real province names - a match is only accepted if it's unique;
 *  2+ candidates is Address Ambiguous, 0 is Address Not Found, exactly
 *  like every other level of this resolver. */
async function resolveProvinceCandidates(
  rawName: string
): Promise<{ province: ProvinceRef; method: 'exact' | 'alias' } | { ambiguous: ProvinceRef[] } | null> {
  const aliasResolved = resolveKnownAlias(rawName);
  const exact = await repository.findProvince(aliasResolved);
  if (exact) return { province: exact, method: aliasResolved !== rawName.trim() ? 'alias' : 'exact' };

  const normalized = normalizeThaiAddressValue(aliasResolved);
  const truncated = normalized.endsWith('ฯ') ? normalized.slice(0, -1) : null;
  if (truncated) {
    const candidates = await repository.findProvincesByPrefix(truncated);
    if (candidates.length === 1) return { province: candidates[0], method: 'alias' };
    if (candidates.length > 1) return { ambiguous: candidates };
  }
  return null;
}

function notFound(reason: string): ThaiAddressResolution {
  return {
    ok: false,
    provinceId: null,
    districtId: null,
    subdistrictId: null,
    normalized: { province: null, district: null, subdistrict: null },
    confidence: 0,
    resolutionMethod: 'not_found',
    reason: `Address Not Found - ${reason}`,
  };
}

function ambiguous(reason: string): ThaiAddressResolution {
  return {
    ok: false,
    provinceId: null,
    districtId: null,
    subdistrictId: null,
    normalized: { province: null, district: null, subdistrict: null },
    confidence: 0,
    resolutionMethod: 'ambiguous',
    reason: `Address Ambiguous - ${reason}`,
  };
}

async function toResolution(
  subdistrict: SubdistrictRef | null,
  district: DistrictRef | null,
  province: ProvinceRef | null,
  method: ThaiAddressResolutionMethod,
  confidence: number
): Promise<ThaiAddressResolution> {
  return {
    ok: true,
    provinceId: province?.provinceId ?? null,
    districtId: district?.districtId ?? null,
    subdistrictId: subdistrict?.tambonId ?? null,
    normalized: {
      province: province?.provinceThai ?? null,
      district: district?.districtThai ?? null,
      subdistrict: subdistrict?.tambonThai ?? null,
    },
    resolutionMethod: method,
    confidence,
  };
}

export interface ThaiAddressResolutionInput {
  province?: string | null;
  district?: string | null;
  subdistrict?: string | null;
}

/**
 * Resolution priority: Subdistrict -> District -> Province - starts from
 * whichever level is most specific and already given, deriving the
 * parent levels from it, rather than requiring the caller to supply a
 * fully consistent top-down triple (that stricter contract remains
 * `validateThaiAddress()`'s job). A given parent-level value is used only
 * to disambiguate when the more specific level's name isn't unique
 * nationally - it never overrides a level that already resolved uniquely
 * on its own.
 */
export async function resolveThaiAddress(input: ThaiAddressResolutionInput): Promise<ThaiAddressResolution> {
  const province = input.province?.trim() || null;
  const district = input.district?.trim() || null;
  const subdistrict = input.subdistrict?.trim() || null;

  if (!province && !district && !subdistrict) {
    return toResolution(null, null, null, 'exact', 1);
  }

  // --- Level 1: Subdistrict (most specific) ---
  if (subdistrict) {
    const matches = await repository.findSubdistrictsByName(subdistrict);
    if (matches.length === 1) {
      const sd = matches[0];
      const d = await repository.findDistrictById(sd.districtId);
      const p = d ? await repository.findProvinceById(d.provinceId) : null;
      return toResolution(sd, d, p, 'exact', 1);
    }
    if (matches.length > 1) {
      // Try to disambiguate using a given District/Province hint before
      // giving up - never picks one arbitrarily.
      const narrowed: { sd: SubdistrictRef; d: DistrictRef; p: ProvinceRef }[] = [];
      for (const sd of matches) {
        const d = await repository.findDistrictById(sd.districtId);
        if (!d) continue;
        const p = await repository.findProvinceById(d.provinceId);
        if (!p) continue;
        const districtOk = !district || normalizeThaiAddressValue(d.districtThai) === normalizeThaiAddressValue(district);
        const provinceOk = !province || normalizeThaiAddressValue(p.provinceThai) === normalizeThaiAddressValue(resolveKnownAlias(province));
        if (districtOk && provinceOk) narrowed.push({ sd, d, p });
      }
      if (narrowed.length === 1) {
        return toResolution(narrowed[0].sd, narrowed[0].d, narrowed[0].p, 'exact', 0.9);
      }
      if (narrowed.length === 0) {
        return ambiguous(
          `Sub-District "${subdistrict}" matches ${matches.length} different locations nationally, and the given District/Province did not narrow it to one`
        );
      }
      return ambiguous(`Sub-District "${subdistrict}" still matches ${narrowed.length} locations after narrowing by District/Province`);
    }
    // 0 subdistrict matches - fall through to District/Province resolution below,
    // since the subdistrict name alone might just be misspelled/unrecognized
    // while District/Province are still resolvable and useful.
  }

  // --- Level 2: District ---
  if (district) {
    const matches = await repository.findDistrictsByName(district);
    if (matches.length === 1) {
      const d = matches[0];
      const p = await repository.findProvinceById(d.provinceId);
      return toResolution(null, d, p, 'exact', subdistrict ? 0.7 : 1);
    }
    if (matches.length > 1) {
      const narrowed: { d: DistrictRef; p: ProvinceRef }[] = [];
      for (const d of matches) {
        const p = await repository.findProvinceById(d.provinceId);
        if (!p) continue;
        if (!province || normalizeThaiAddressValue(p.provinceThai) === normalizeThaiAddressValue(resolveKnownAlias(province))) {
          narrowed.push({ d, p });
        }
      }
      if (narrowed.length === 1) {
        return toResolution(null, narrowed[0].d, narrowed[0].p, 'exact', 0.8);
      }
      if (narrowed.length === 0) {
        return ambiguous(`District "${district}" matches ${matches.length} different provinces, and the given Province did not narrow it to one`);
      }
      return ambiguous(`District "${district}" still matches ${narrowed.length} provinces after narrowing by Province`);
    }
    // 0 district matches - fall through to Province alone.
  }

  // --- Level 3: Province ---
  if (province) {
    const result = await resolveProvinceCandidates(province);
    if (result && 'province' in result) {
      return toResolution(null, null, result.province, result.method, result.method === 'exact' ? 1 : 0.85);
    }
    if (result && 'ambiguous' in result) {
      return ambiguous(`Province "${province}" (after truncation) matches ${result.ambiguous.length} provinces`);
    }
  }

  return notFound(
    `none of Subdistrict "${subdistrict ?? '-'}" / District "${district ?? '-'}" / Province "${province ?? '-'}" matched a known Thailand location`
  );
}
