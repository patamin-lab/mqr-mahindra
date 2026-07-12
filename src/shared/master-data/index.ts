/**
 * MASP Platform — public barrel. Import `MasterDataService` (and the
 * types re-exported below) from here - never reach into
 * `address/`/`lookup/`/`config/`/`reference/` directly, the same
 * boundary convention `shared/attachments`' `AttachmentService` already
 * established.
 */
export { MasterDataService } from './MasterDataService';
export type { AddressValidationInput, AddressValidationResult } from './address/addressValidation';
export type { ProvinceRef, DistrictRef, SubdistrictRef } from './address/AddressRepository';
export type { ThaiAddressResolutionInput, ThaiAddressResolution, ThaiAddressResolutionMethod } from './address/ThailandAddressResolver';
export type { MasterDataResolution, MasterDataResolutionMethod } from './MasterDataResolver';
export type { CustomerType } from './lookup/customerType';
export type { CustomerTitle } from './lookup/customerTitle';
export type { AttachmentType } from './lookup/attachmentType';
export type { Severity } from './lookup/severity';
export type { StatusValue } from './lookup/status';
export type { WarrantyProblemSystem } from './config/businessConfig';
