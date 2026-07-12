/**
 * Address Platform — Supabase-backed repository (v2, ADR-011 supersession).
 *
 * The one data-access layer for canonical Thai Province/District/
 * Subdistrict/Postcode reference data (`provinces`/`districts`/
 * `subdistricts` tables - deduplicated, with PK/FK/indexes, populated
 * from the raw import via migration `address_platform_canonical_tables`).
 * `MasterDataService` is the only caller - per the Master Data Platform
 * rule, no business module imports this file directly, and this file
 * never reads `*_raw` (those remain immutable seed/backup data only).
 *
 * Results are cached in memory for the lifetime of the serverless
 * instance - this reference data changes on the order of years, not
 * requests - satisfying the "Cached" AddressSelector requirement without
 * re-querying Supabase on every lookup (avoids the N+1 pattern the
 * Performance standard warns against for a page rendering many rows).
 */
import { getSupabase } from '@/lib/supabase';

export interface ProvinceRef {
  provinceId: string;
  provinceThai: string;
}

export interface DistrictRef {
  districtId: string;
  districtThai: string;
  provinceId: string;
}

export interface SubdistrictRef {
  tambonId: string;
  tambonThai: string;
  districtId: string;
  /** The DB's `subdistricts.postcode` column holds a single value; kept
   *  as an array here (0 or 1 entries) so callers written against the
   *  pre-v2 JSON-backed shape (which supported multiple codes per
   *  subdistrict) don't need to change. */
  postalCodes: string[];
}

/** Common Thai administrative-unit prefixes a caller's free-text input
 *  might or might not include (`อำเภอเมืองบุรีรัมย์` vs `เมืองบุรีรัมย์`) -
 *  stripped before matching against the DB's stored (prefixed) name.
 *  Longest-prefix-first so `กิ่งอำเภอ` matches before `อำเภอ` would
 *  incorrectly strip only part of it. */
const PREFIXES = ['กิ่งอำเภอ', 'จังหวัด', 'อำเภอ', 'เขต', 'ตำบล', 'แขวง'];

export function normalizeThaiAddressValue(raw: string): string {
  let value = raw.trim().replace(/\s+/g, ' ');
  for (const prefix of PREFIXES) {
    if (value.startsWith(prefix)) {
      value = value.slice(prefix.length).trim();
      break;
    }
  }
  return value;
}

export class AddressRepository {
  /** Instance-level cache (not module-level) - `MasterDataService` holds
   *  one long-lived instance per serverless process, giving the same
   *  "load once, reuse for every caller" behavior the pre-v2 JSON index
   *  had, without a shared global that would make fresh-instance tests
   *  interfere with each other. */
  private provinceCache: ProvinceRef[] | null = null;
  private districtCache = new Map<string, DistrictRef[]>();
  private subdistrictCache = new Map<string, SubdistrictRef[]>();
  /** Every district, regardless of province - only populated on first
   *  cross-province lookup (`findDistrictsByName`, Import Platform v2 /
   *  ADR-022's bottom-up address resolution). `listDistricts(provinceId)`
   *  above remains the province-scoped cache `AddressSelector` uses;
   *  this is a second, table-wide cache, not a replacement. */
  private allDistrictsCache: DistrictRef[] | null = null;
  /** Every subdistrict, regardless of district - same reasoning as
   *  `allDistrictsCache`. 7,436 rows, the same table `listSubdistricts`
   *  already reads a slice of; fetched once, whole, only when a caller
   *  actually needs a cross-district name search. */
  private allSubdistrictsCache: SubdistrictRef[] | null = null;

  async listProvinces(): Promise<ProvinceRef[]> {
    if (this.provinceCache) return this.provinceCache;
    const { data, error } = await getSupabase()
      .from('provinces')
      .select('province_id, province_name_th')
      .order('province_name_th', { ascending: true });
    if (error) throw error;
    this.provinceCache = (data ?? []).map((r) => ({ provinceId: String(r.province_id), provinceThai: r.province_name_th as string }));
    return this.provinceCache;
  }

  async listDistricts(provinceId: string): Promise<DistrictRef[]> {
    const cached = this.districtCache.get(provinceId);
    if (cached) return cached;
    const { data, error } = await getSupabase()
      .from('districts')
      .select('district_id, district_name_th, province_id')
      .eq('province_id', provinceId)
      .order('district_name_th', { ascending: true });
    if (error) throw error;
    const result = (data ?? []).map((r) => ({
      districtId: String(r.district_id),
      districtThai: r.district_name_th as string,
      provinceId: String(r.province_id),
    }));
    this.districtCache.set(provinceId, result);
    return result;
  }

  async listSubdistricts(districtId: string): Promise<SubdistrictRef[]> {
    const cached = this.subdistrictCache.get(districtId);
    if (cached) return cached;
    const { data, error } = await getSupabase()
      .from('subdistricts')
      .select('subdistrict_id, subdistrict_name_th, district_id, postcode')
      .eq('district_id', districtId)
      .order('subdistrict_name_th', { ascending: true });
    if (error) throw error;
    const result = (data ?? []).map((r) => ({
      tambonId: String(r.subdistrict_id),
      tambonThai: r.subdistrict_name_th as string,
      districtId: String(r.district_id),
      postalCodes: r.postcode != null ? [String(r.postcode)] : [],
    }));
    this.subdistrictCache.set(districtId, result);
    return result;
  }

  async findProvince(name: string): Promise<ProvinceRef | null> {
    const target = normalizeThaiAddressValue(name);
    const provinces = await this.listProvinces();
    return provinces.find((p) => normalizeThaiAddressValue(p.provinceThai) === target) ?? null;
  }

  async findDistrict(name: string, provinceId: string): Promise<DistrictRef | null> {
    const target = normalizeThaiAddressValue(name);
    const districts = await this.listDistricts(provinceId);
    return districts.find((d) => normalizeThaiAddressValue(d.districtThai) === target) ?? null;
  }

  async findSubdistrict(name: string, districtId: string): Promise<SubdistrictRef | null> {
    const target = normalizeThaiAddressValue(name);
    const subdistricts = await this.listSubdistricts(districtId);
    return subdistricts.find((s) => normalizeThaiAddressValue(s.tambonThai) === target) ?? null;
  }

  /** Whole-table fetch, cached - see `allDistrictsCache`'s doc comment.
   *  Not used by `AddressSelector`'s cascading dropdown (which only ever
   *  needs one province's districts); this backs cross-province name
   *  search for bottom-up address resolution (ADR-022). */
  private async listAllDistricts(): Promise<DistrictRef[]> {
    if (this.allDistrictsCache) return this.allDistrictsCache;
    const { data, error } = await getSupabase()
      .from('districts')
      .select('district_id, district_name_th, province_id')
      .order('district_name_th', { ascending: true });
    if (error) throw error;
    this.allDistrictsCache = (data ?? []).map((r) => ({
      districtId: String(r.district_id),
      districtThai: r.district_name_th as string,
      provinceId: String(r.province_id),
    }));
    return this.allDistrictsCache;
  }

  private async listAllSubdistricts(): Promise<SubdistrictRef[]> {
    if (this.allSubdistrictsCache) return this.allSubdistrictsCache;
    const { data, error } = await getSupabase()
      .from('subdistricts')
      .select('subdistrict_id, subdistrict_name_th, district_id, postcode')
      .order('subdistrict_name_th', { ascending: true });
    if (error) throw error;
    this.allSubdistrictsCache = (data ?? []).map((r) => ({
      tambonId: String(r.subdistrict_id),
      tambonThai: r.subdistrict_name_th as string,
      districtId: String(r.district_id),
      postalCodes: r.postcode != null ? [String(r.postcode)] : [],
    }));
    return this.allSubdistrictsCache;
  }

  /** Every district (in any province) whose normalized name exactly
   *  matches - a name that isn't unique nationally (e.g. two provinces
   *  each having a district of the same name) returns more than one
   *  entry; the caller (`ThailandAddressResolver`) treats 2+ as
   *  ambiguous, never guesses which one was meant. */
  async findDistrictsByName(name: string): Promise<DistrictRef[]> {
    const target = normalizeThaiAddressValue(name);
    const all = await this.listAllDistricts();
    return all.filter((d) => normalizeThaiAddressValue(d.districtThai) === target);
  }

  /** Every subdistrict (in any district/province) whose normalized name
   *  exactly matches - same "2+ matches is ambiguous" contract as
   *  `findDistrictsByName`. This is the entry point for "resolve from
   *  Subdistrict alone" (ADR-022's Subdistrict -> District -> Province
   *  priority) - subdistrict names are the most specific and least
   *  ambiguous of the three levels in practice, but still not guaranteed
   *  unique nationally. */
  async findSubdistrictsByName(name: string): Promise<SubdistrictRef[]> {
    const target = normalizeThaiAddressValue(name);
    const all = await this.listAllSubdistricts();
    return all.filter((s) => normalizeThaiAddressValue(s.tambonThai) === target);
  }

  /** All provinces whose normalized name *starts with* the given
   *  (already-normalized) prefix - backs the "ฯ truncation" alias
   *  pattern (e.g. "นครศรีฯ" -> strip the ฯ -> prefix-match
   *  "นครศรี" -> "นครศรีธรรมราช") without hardcoding every province's
   *  possible abbreviation. 2+ matches is ambiguous, 0 is not found -
   *  the same contract as the exact-match finders above. */
  async findProvincesByPrefix(prefix: string): Promise<ProvinceRef[]> {
    const target = normalizeThaiAddressValue(prefix);
    if (!target) return [];
    const all = await this.listProvinces();
    return all.filter((p) => normalizeThaiAddressValue(p.provinceThai).startsWith(target));
  }

  /** By-id lookups, backed by the same whole-table caches - used to walk
   *  "up" from a resolved subdistrict/district to its parent(s) (ADR-022's
   *  bottom-up resolution needs a district's `provinceId` once it has
   *  matched a subdistrict by name alone). */
  async findDistrictById(districtId: string): Promise<DistrictRef | null> {
    const all = await this.listAllDistricts();
    return all.find((d) => d.districtId === districtId) ?? null;
  }

  async findProvinceById(provinceId: string): Promise<ProvinceRef | null> {
    const all = await this.listProvinces();
    return all.find((p) => p.provinceId === provinceId) ?? null;
  }
}
