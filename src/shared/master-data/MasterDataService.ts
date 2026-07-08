/**
 * MASP Platform — MasterDataService.
 *
 * The one public entry point for every "master/reference/lookup data"
 * concern a business module needs: Address (Thai province/district/
 * subdistrict/postal-code lookup + hierarchy validation), Lookup
 * (controlled-vocabulary values like Customer Type), Configuration
 * (business-rule constants), and Reference Data (dealers/branches/
 * technicians/product families). Mirrors this repo's established
 * platform-service shape (`AttachmentService` - see
 * `docs/architecture/PLATFORM_CONSTITUTION.md`'s Platform Service
 * Boundaries section): one public class, internals (the individual
 * `address/`/`lookup/`/`config/`/`reference/` modules) are implementation
 * detail a module should not import directly.
 *
 * A static-method class rather than an instantiated service, matching
 * the fact that none of the four sub-domains hold per-request state
 * (the address index and reference-data reads are either a module-level
 * cache or a stateless pass-through) - there is nothing to construct.
 */
import * as address from './address/thaiAddressData';
import { validateThaiAddress, type AddressValidationInput, type AddressValidationResult } from './address/addressValidation';
import {
  CUSTOMER_TYPE_VALUES,
  CUSTOMER_TYPE_LABELS_TH,
  CUSTOMER_TYPE_LABELS_EN,
  normalizeCustomerType,
  type CustomerType,
} from './lookup/customerType';
import { getWarrantyLimitMonths, type WarrantyProblemSystem } from './config/businessConfig';
import * as reference from './reference/referenceData';

export class MasterDataService {
  // ---- Address Platform ----
  static findProvince = address.findProvince;
  static findDistrict = address.findDistrict;
  static findSubdistrict = address.findSubdistrict;
  static normalizeThaiAddressValue = address.normalizeThaiAddressValue;
  static validateThaiAddress(input: AddressValidationInput): AddressValidationResult {
    return validateThaiAddress(input);
  }

  // ---- Lookup Platform ----
  static readonly customerTypeValues: CustomerType[] = CUSTOMER_TYPE_VALUES;
  static customerTypeLabel(value: CustomerType, locale: 'th' | 'en' = 'th'): string {
    return (locale === 'th' ? CUSTOMER_TYPE_LABELS_TH : CUSTOMER_TYPE_LABELS_EN)[value];
  }
  static normalizeCustomerType(value: string): CustomerType | null {
    return normalizeCustomerType(value);
  }

  // ---- Configuration Platform ----
  static getWarrantyLimitMonths(problemSystem: WarrantyProblemSystem): number {
    return getWarrantyLimitMonths(problemSystem);
  }

  // ---- Reference Data Platform ----
  static getDealers = reference.getDealers;
  static getDealerById = reference.getDealerById;
  static getBranchesForDealer = reference.getBranchesForDealer;
  static getBranch = reference.getBranch;
  static getTechniciansForDealer = reference.getTechniciansForDealer;
  static getActiveProductFamilies = reference.getActiveProductFamilies;
  static getProductFamilyById = reference.getProductFamilyById;
}
