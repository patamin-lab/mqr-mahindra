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
 * Plain native `<select>` per level, no search-filter input (NTR Form
 * Update, 2026-07, removed the filter inputs ADR-011 had added) - a
 * child's option list is only ever populated with real children of the
 * selected parent, so an invalid Province/District/Subdistrict can never
 * be entered. Native `<select>` keeps keyboard accessibility for free.
 */
import { useEffect, useRef, useState } from 'react';
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

export default function AddressSelector({ value, onChange, disabled }: AddressSelectorProps) {
  const { t } = useTranslation();
  const [provinces, setProvinces] = useState<ProvinceRef[]>([]);
  const [districts, setDistricts] = useState<DistrictRef[]>([]);
  const [subdistricts, setSubdistricts] = useState<SubdistrictRef[]>([]);
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
    const province = provinces.find((p) => p.provinceThai === provinceThai);
    if (province) setDistricts(await loadDistricts(province.provinceId));
  }

  async function handleDistrictChange(districtThai: string) {
    onChange({ ...value, district: districtThai, subdistrict: '', postalCode: '' });
    setSubdistricts([]);
    const district = districts.find((d) => d.districtThai === districtThai);
    if (district) setSubdistricts(await loadSubdistricts(district.districtId));
  }

  function handleSubdistrictChange(tambonThai: string) {
    const subdistrict = subdistricts.find((s) => s.tambonThai === tambonThai);
    const postalCode = subdistrict && subdistrict.postalCodes.length === 1 ? subdistrict.postalCodes[0] : '';
    onChange({ ...value, subdistrict: tambonThai, postalCode: postalCode || value.postalCode });
  }

  const provinceOptions: SelectOption[] = [
    { value: '', label: t('address.selectProvince') },
    ...provinces.map((p) => ({ value: p.provinceThai, label: p.provinceThai })),
  ];
  const districtOptions: SelectOption[] = [
    { value: '', label: t('address.selectDistrict') },
    ...districts.map((d) => ({ value: d.districtThai, label: d.districtThai })),
  ];
  const subdistrictOptions: SelectOption[] = [
    { value: '', label: t('address.selectSubdistrict') },
    ...subdistricts.map((s) => ({ value: s.tambonThai, label: s.tambonThai })),
  ];

  return (
    <>
      <TextField label={t('csv.customerAddress')} value={value.address} onChange={(v) => onChange({ ...value, address: v })} disabled={disabled} />
      <SelectField label={t('csv.province')} value={value.province} onChange={handleProvinceChange} options={provinceOptions} disabled={disabled} />
      <SelectField
        label={t('csv.district')}
        value={value.district}
        onChange={handleDistrictChange}
        options={districtOptions}
        disabled={disabled || !value.province}
      />
      <SelectField
        label={t('csv.subdistrict')}
        value={value.subdistrict}
        onChange={handleSubdistrictChange}
        options={subdistrictOptions}
        disabled={disabled || !value.district}
      />
      <TextField label={t('csv.postalCode')} value={value.postalCode} onChange={(v) => onChange({ ...value, postalCode: v })} disabled={disabled} />
    </>
  );
}
