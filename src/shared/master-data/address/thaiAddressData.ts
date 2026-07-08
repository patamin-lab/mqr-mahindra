/**
 * MASP Platform — Address Platform: Thailand Province / District /
 * Subdistrict / Postal Code master data.
 *
 * Platform service (`src/shared/master-data/`) - every module needing
 * Thai address lookup/validation goes through this, never its own copy
 * (originally built for and used only by NTR; promoted to a shared
 * platform service so any future module needing address validation
 * reuses it instead of re-implementing).
 *
 * Source of truth: `data/thaiAddressMaster.json`, a one-time export of
 * the "Thai Province+DIstrict+Tambon.xlsx" reference file's
 * `TambonDatabase` sheet (7,436 rows - every subdistrict in Thailand,
 * with its parent district and province, in Thai and English, full and
 * short forms, plus postal code(s)). This module never re-reads that
 * spreadsheet at runtime and never queries a database for it - loaded
 * into memory exactly once (module-level singleton, built lazily on
 * first use), then reused for every caller - satisfying "load the
 * address master ONCE into memory, never a lookup per row."
 *
 * Regenerating the JSON (only needed if Thailand's official province/
 * district/subdistrict list changes) is a manual, explicit step - not
 * part of any build script, since the source spreadsheet is an external
 * reference file, not something this repository tracks changes to
 * automatically.
 */
import thaiAddressData from './data/thaiAddressMaster.json';

interface TambonRow {
  tambonId: string;
  tambonThai: string;
  tambonEng: string;
  tambonThaiShort: string;
  tambonEngShort: string;
  districtId: string;
  districtThai: string;
  districtEng: string;
  districtThaiShort: string;
  districtEngShort: string;
  provinceId: string;
  provinceThai: string;
  provinceEng: string;
  postCodeMain: string | null;
  postCodeAll: string | null;
}

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
  postalCodes: string[];
}

/** Common Thai administrative-unit prefixes a dealer's spreadsheet might
 *  or might not include (`อำเภอเมืองบุรีรัมย์` vs `เมืองบุรีรัมย์`) - the
 *  master data itself already records both the full and short form for
 *  every row, so normalization only needs to strip these prefixes before
 *  matching against either form, never invent its own abbreviation
 *  mapping. Longest-prefix-first so `กิ่งอำเภอ` matches before `อำเภอ`
 *  would incorrectly strip only part of it. */
const PREFIXES = ['กิ่งอำเภอ', 'จังหวัด', 'อำเภอ', 'เขต', 'ตำบล', 'แขวง'];

/** Normalizes free-text Thai administrative-unit input for matching only
 *  - never used to overwrite what a user/import row actually typed.
 *  Handles: leading/trailing spaces, multiple internal spaces collapsed
 *  to one, and a leading province/district/subdistrict-type prefix
 *  stripped so "อำเภอเมืองบุรีรัมย์" and "เมืองบุรีรัมย์" compare equal. */
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

interface AddressIndex {
  provincesByName: Map<string, ProvinceRef>;
  districtsByProvinceId: Map<string, Map<string, DistrictRef>>;
  subdistrictsByDistrictId: Map<string, Map<string, SubdistrictRef>>;
  /** Sorted, de-duplicated listing views for cascading-select UI
   *  (`AddressSelector`) - the by-name maps above hold two keys per entry
   *  (full + short form), so they can't be iterated directly as an
   *  options list without duplicates. */
  provinceList: ProvinceRef[];
  districtListByProvinceId: Map<string, DistrictRef[]>;
  subdistrictListByDistrictId: Map<string, SubdistrictRef[]>;
}

let cachedIndex: AddressIndex | null = null;

function splitPostalCodes(postCodeAll: string | null, postCodeMain: string | null): string[] {
  const raw = postCodeAll ?? postCodeMain ?? '';
  return raw
    .split(/[,/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildIndex(): AddressIndex {
  const provincesByName = new Map<string, ProvinceRef>();
  const districtsByProvinceId = new Map<string, Map<string, DistrictRef>>();
  const subdistrictsByDistrictId = new Map<string, Map<string, SubdistrictRef>>();
  const provinceList: ProvinceRef[] = [];
  const districtListByProvinceId = new Map<string, DistrictRef[]>();
  const subdistrictListByDistrictId = new Map<string, SubdistrictRef[]>();
  const seenDistrictIds = new Set<string>();
  const seenTambonIds = new Set<string>();

  for (const row of thaiAddressData as TambonRow[]) {
    const provinceKey = normalizeThaiAddressValue(row.provinceThai);
    if (!provincesByName.has(provinceKey)) {
      const provinceRef: ProvinceRef = { provinceId: row.provinceId, provinceThai: row.provinceThai };
      provincesByName.set(provinceKey, provinceRef);
      provinceList.push(provinceRef);
    }

    let districtMap = districtsByProvinceId.get(row.provinceId);
    if (!districtMap) {
      districtMap = new Map();
      districtsByProvinceId.set(row.provinceId, districtMap);
    }
    const districtRef: DistrictRef = { districtId: row.districtId, districtThai: row.districtThai, provinceId: row.provinceId };
    districtMap.set(normalizeThaiAddressValue(row.districtThai), districtRef);
    districtMap.set(normalizeThaiAddressValue(row.districtThaiShort), districtRef);
    if (!seenDistrictIds.has(row.districtId)) {
      seenDistrictIds.add(row.districtId);
      let list = districtListByProvinceId.get(row.provinceId);
      if (!list) {
        list = [];
        districtListByProvinceId.set(row.provinceId, list);
      }
      list.push(districtRef);
    }

    let subdistrictMap = subdistrictsByDistrictId.get(row.districtId);
    if (!subdistrictMap) {
      subdistrictMap = new Map();
      subdistrictsByDistrictId.set(row.districtId, subdistrictMap);
    }
    const subdistrictRef: SubdistrictRef = {
      tambonId: row.tambonId,
      tambonThai: row.tambonThai,
      districtId: row.districtId,
      postalCodes: splitPostalCodes(row.postCodeAll, row.postCodeMain),
    };
    subdistrictMap.set(normalizeThaiAddressValue(row.tambonThai), subdistrictRef);
    subdistrictMap.set(normalizeThaiAddressValue(row.tambonThaiShort), subdistrictRef);
    if (!seenTambonIds.has(row.tambonId)) {
      seenTambonIds.add(row.tambonId);
      let list = subdistrictListByDistrictId.get(row.districtId);
      if (!list) {
        list = [];
        subdistrictListByDistrictId.set(row.districtId, list);
      }
      list.push(subdistrictRef);
    }
  }

  provinceList.sort((a, b) => a.provinceThai.localeCompare(b.provinceThai, 'th'));
  for (const list of districtListByProvinceId.values()) list.sort((a, b) => a.districtThai.localeCompare(b.districtThai, 'th'));
  for (const list of subdistrictListByDistrictId.values()) list.sort((a, b) => a.tambonThai.localeCompare(b.tambonThai, 'th'));

  return { provincesByName, districtsByProvinceId, subdistrictsByDistrictId, provinceList, districtListByProvinceId, subdistrictListByDistrictId };
}

/** Builds the in-memory index on first call, reused for every subsequent
 *  call within this process - the "load once" requirement. A serverless
 *  cold start pays this cost once per instance, not once per row. */
function getIndex(): AddressIndex {
  if (!cachedIndex) cachedIndex = buildIndex();
  return cachedIndex;
}

export function findProvince(name: string): ProvinceRef | null {
  return getIndex().provincesByName.get(normalizeThaiAddressValue(name)) ?? null;
}

export function findDistrict(name: string, provinceId: string): DistrictRef | null {
  return getIndex().districtsByProvinceId.get(provinceId)?.get(normalizeThaiAddressValue(name)) ?? null;
}

export function findSubdistrict(name: string, districtId: string): SubdistrictRef | null {
  return getIndex().subdistrictsByDistrictId.get(districtId)?.get(normalizeThaiAddressValue(name)) ?? null;
}

/** Listing views for a cascading Province/District/Subdistrict select
 *  (`AddressSelector`) - sorted, one entry per real administrative unit. */
export function listProvinces(): ProvinceRef[] {
  return getIndex().provinceList;
}

export function listDistricts(provinceId: string): DistrictRef[] {
  return getIndex().districtListByProvinceId.get(provinceId) ?? [];
}

export function listSubdistricts(districtId: string): SubdistrictRef[] {
  return getIndex().subdistrictListByDistrictId.get(districtId) ?? [];
}
