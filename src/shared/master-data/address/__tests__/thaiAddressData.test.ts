import { describe, it, expect } from 'vitest';
import { listProvinces, listDistricts, listSubdistricts, findProvince, findDistrict } from '../thaiAddressData';

describe('Address Platform - listing views (AddressSelector support)', () => {
  it('lists every province exactly once, sorted', () => {
    const provinces = listProvinces();
    expect(provinces.length).toBeGreaterThan(70);
    const ids = provinces.map((p) => p.provinceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('lists districts scoped to their province only', () => {
    const buriram = findProvince('บุรีรัมย์');
    expect(buriram).not.toBeNull();
    const districts = listDistricts(buriram!.provinceId);
    expect(districts.length).toBeGreaterThan(0);
    expect(districts.every((d) => d.provinceId === buriram!.provinceId)).toBe(true);
  });

  it('lists subdistricts scoped to their district only, with postal codes', () => {
    const buriram = findProvince('บุรีรัมย์')!;
    const district = findDistrict('เมืองบุรีรัมย์', buriram.provinceId);
    expect(district).not.toBeNull();
    const subdistricts = listSubdistricts(district!.districtId);
    expect(subdistricts.length).toBeGreaterThan(0);
    expect(subdistricts.every((s) => s.districtId === district!.districtId)).toBe(true);
    expect(subdistricts[0].postalCodes.length).toBeGreaterThan(0);
  });

  it('returns an empty list for an unknown province/district id', () => {
    expect(listDistricts('__no_such_province__')).toEqual([]);
    expect(listSubdistricts('__no_such_district__')).toEqual([]);
  });
});
