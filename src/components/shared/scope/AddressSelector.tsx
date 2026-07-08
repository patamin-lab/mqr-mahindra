'use client';

/**
 * Address Platform - shared cascading Province/District/Subdistrict/
 * Postal Code selector. Every module capturing a Thai address (NTR
 * today; any future module - Warranty, Campaign - reuses this instead of
 * a second copy of free-text fields with no hierarchy validation).
 *
 * Fetches the Province/District/Subdistrict lists from `/api/master/*`
 * (never bundles the ~3.5MB address master data into client JS) and
 * caches each level's children in a `Map` the same way
 * `useDealerBranchScope` caches per-dealer branches - switching back to a
 * previously-selected province/district never refetches.
 *
 * "Searchable Dropdown" (MASP Enterprise Development Standard, Address
 * Platform requirements) is implemented as a filter text input paired
 * with each native `<select>`, narrowing its option list as the user
 * types - not a free-text `<input list>`/combobox, so an invalid
 * Province/District/Subdistrict can never be entered (only real options
 * ever appear in the `<select>`). Native `<select>` keeps keyboard
 * accessibility for free. See `docs/adr/ADR-011-Address-Platform.md`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchJson } from '@/lib/fetchJson';
import TextField from '@/components/shared/forms/TextField';
import SelectField, { type SelectOption } from '@/components/shared/forms/SelectField';
import type { ProvinceRef, DistrictRef, SubdistrictRef } from '@/shared/master-data';
import { useTranslation } from '@/lib/i18n/LocaleProvider';

export interface AddressValue {
  address: string;
  province: string;
  district: string;
  subdistrict: string;
  postalCode: string;
}

export interface AddressSelectorProps {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  disabled?: boolean;
}

function useFilteredOptions<T extends { label: string }>(all: T[], filter: string): T[] {
  return useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((o) => o.label.toLowerCase().includes(q));
  }, [all, filter]);
}

export default function AddressSelector({ value, onChange, disabled }: AddressSelectorProps) {
  const { t } = useTranslation();
  const [provinces, setProvinces] = useState<ProvinceRef[]>([]);
  const [districts, setDistricts] = useState<DistrictRef[]>([]);
  const [subdistricts, setSubdistricts] = useState<SubdistrictRef[]>([]);
  const [provinceFilter, setProvinceFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [subdistrictFilter, setSubdistrictFilter] = useState('');
  const districtCache = useRef(new Map<string, DistrictRef[]>());
  const subdistrictCache = useRef(new Map<string, SubdistrictRef[]>());

  useEffect(() => {
    (async () => {
      try {
        const json = await fetchJson<{ ok: boolean; provinces: ProvinceRef[] }>('/api/master/provinces');
        setProvinces(json.provinces ?? []);
      } catch {
        setProvinces([]);
      }
    })();
  }, []);

  async function loadDistricts(provinceId: string): Promise<DistrictRef[]> {
    const cached = districtCache.current.get(provinceId);
    if (cached) return cached;
    try {
      const json = await fetchJson<{ ok: boolean; districts: DistrictRef[] }>(`/api/master/districts?province_id=${encodeURIComponent(provinceId)}`);
      districtCache.current.set(provinceId, json.districts ?? []);
      return json.districts ?? [];
    } catch {
      return [];
    }
  }

  async function loadSubdistricts(districtId: string): Promise<SubdistrictRef[]> {
    const cached = subdistrictCache.current.get(districtId);
    if (cached) return cached;
    try {
      const json = await fetchJson<{ ok: boolean; subdistricts: SubdistrictRef[] }>(`/api/master/subdistricts?district_id=${encodeURIComponent(districtId)}`);
      subdistrictCache.current.set(districtId, json.subdistricts ?? []);
      return json.subdistricts ?? [];
    } catch {
      return [];
    }
  }

  async function handleProvinceChange(provinceThai: string) {
    onChange({ ...value, province: provinceThai, district: '', subdistrict: '', postalCode: '' });
    setDistricts([]);
    setSubdistricts([]);
    setDistrictFilter('');
    setSubdistrictFilter('');
    const province = provinces.find((p) => p.provinceThai === provinceThai);
    if (province) setDistricts(await loadDistricts(province.provinceId));
  }

  async function handleDistrictChange(districtThai: string) {
    onChange({ ...value, district: districtThai, subdistrict: '', postalCode: '' });
    setSubdistricts([]);
    setSubdistrictFilter('');
    const district = districts.find((d) => d.districtThai === districtThai);
    if (district) setSubdistricts(await loadSubdistricts(district.districtId));
  }

  function handleSubdistrictChange(tambonThai: string) {
    const subdistrict = subdistricts.find((s) => s.tambonThai === tambonThai);
    const postalCode = subdistrict && subdistrict.postalCodes.length === 1 ? subdistrict.postalCodes[0] : '';
    onChange({ ...value, subdistrict: tambonThai, postalCode: postalCode || value.postalCode });
  }

  const provinceAllOptions: SelectOption[] = provinces.map((p) => ({ value: p.provinceThai, label: p.provinceThai }));
  const districtAllOptions: SelectOption[] = districts.map((d) => ({ value: d.districtThai, label: d.districtThai }));
  const subdistrictAllOptions: SelectOption[] = subdistricts.map((s) => ({ value: s.tambonThai, label: s.tambonThai }));

  const provinceOptions: SelectOption[] = [{ value: '', label: t('address.selectProvince') }, ...useFilteredOptions(provinceAllOptions, provinceFilter)];
  const districtOptions: SelectOption[] = [{ value: '', label: t('address.selectDistrict') }, ...useFilteredOptions(districtAllOptions, districtFilter)];
  const subdistrictOptions: SelectOption[] = [
    { value: '', label: t('address.selectSubdistrict') },
    ...useFilteredOptions(subdistrictAllOptions, subdistrictFilter),
  ];

  return (
    <>
      <TextField label={t('csv.customerAddress')} value={value.address} onChange={(v) => onChange({ ...value, address: v })} disabled={disabled} />

      <div>
        <input
          type="text"
          value={provinceFilter}
          onChange={(e) => setProvinceFilter(e.target.value)}
          placeholder={t('address.searchProvince')}
          disabled={disabled}
          aria-label={t('address.searchProvince')}
          className="mb-1 w-full rounded border px-2 py-1 text-xs"
        />
        <SelectField label={t('csv.province')} value={value.province} onChange={handleProvinceChange} options={provinceOptions} disabled={disabled} />
      </div>

      <div>
        <input
          type="text"
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          placeholder={t('address.searchDistrict')}
          disabled={disabled || !value.province}
          aria-label={t('address.searchDistrict')}
          className="mb-1 w-full rounded border px-2 py-1 text-xs"
        />
        <SelectField
          label={t('csv.district')}
          value={value.district}
          onChange={handleDistrictChange}
          options={districtOptions}
          disabled={disabled || !value.province}
        />
      </div>

      <div>
        <input
          type="text"
          value={subdistrictFilter}
          onChange={(e) => setSubdistrictFilter(e.target.value)}
          placeholder={t('address.searchSubdistrict')}
          disabled={disabled || !value.district}
          aria-label={t('address.searchSubdistrict')}
          className="mb-1 w-full rounded border px-2 py-1 text-xs"
        />
        <SelectField
          label={t('csv.subdistrict')}
          value={value.subdistrict}
          onChange={handleSubdistrictChange}
          options={subdistrictOptions}
          disabled={disabled || !value.district}
        />
      </div>

      <TextField label={t('csv.postalCode')} value={value.postalCode} onChange={(v) => onChange({ ...value, postalCode: v })} disabled={disabled} />
    </>
  );
}
