import { describe, it, expect } from 'vitest';
import { MasterDataService } from '../MasterDataService';

describe('MasterDataService - public facade', () => {
  it('exposes the Address Platform', () => {
    expect(MasterDataService.findProvince('บุรีรัมย์')).not.toBeNull();
    expect(MasterDataService.validateThaiAddress({ province: null, district: null, subdistrict: null, postalCode: null })).toEqual({ ok: true });
  });

  it('exposes the Lookup Platform', () => {
    expect(MasterDataService.customerTypeValues).toEqual(['Individual', 'Company']);
    expect(MasterDataService.customerTypeLabel('Individual', 'en')).toBe('Individual');
    expect(MasterDataService.normalizeCustomerType('company')).toBe('Company');
  });

  it('exposes the Configuration Platform', () => {
    expect(MasterDataService.getWarrantyLimitMonths('powertrain')).toBe(48);
    expect(MasterDataService.getWarrantyLimitMonths('other')).toBe(24);
  });

  it('exposes the Reference Data Platform as callable functions', () => {
    expect(typeof MasterDataService.getDealers).toBe('function');
    expect(typeof MasterDataService.getDealerById).toBe('function');
    expect(typeof MasterDataService.getBranchesForDealer).toBe('function');
    expect(typeof MasterDataService.getBranch).toBe('function');
    expect(typeof MasterDataService.getTechniciansForDealer).toBe('function');
    expect(typeof MasterDataService.getActiveProductFamilies).toBe('function');
    expect(typeof MasterDataService.getProductFamilyById).toBe('function');
  });
});
