/**
 * NTR (New Tractor Registration) — shared types.
 *
 * Business wording: "NTR" everywhere user-facing (per
 * docs/standards/DOMAIN_LANGUAGE_STANDARD.md - "Tractor", never "Vehicle").
 * Database table `ntr_records`. Mirrors the exact field-snapshot
 * convention already used by `pm_records`/`records`: `serial`/`model`/
 * `engine_number` are a point-in-time copy of the selected Tractor
 * (`vehicles` table), never a live join back to it, so a registration
 * stays historically accurate even if the vehicle's master data changes
 * later.
 */

export type NtrCustomerType = 'Individual' | 'Company';

/** Standardized attachment categories - future modules (PM, Warranty,
 *  Campaign) reuse these same keys/labels rather than inventing their own
 *  (see docs/standards/DOMAIN_LANGUAGE_STANDARD.md). Stored via the
 *  existing `additional_photos: {url,label}[]` array for the categories
 *  with no dedicated column (Customer ID, Tax Invoice, CRM Lead, Other) -
 *  the four with a dedicated required column
 *  (photo_customer_tractor_url/photo_serial_plate_url/
 *  photo_hour_meter_url/photo_signed_document_url) map onto
 *  CUSTOMER_TRACTOR/SERIAL_PLATE/HOUR_METER/DELIVERY_SHEET. No schema
 *  change was needed to standardize this taxonomy. */
export const NTR_ATTACHMENT_TYPES = [
  'CUSTOMER_ID',
  'CUSTOMER_TRACTOR',
  'SERIAL_PLATE',
  'ENGINE_PLATE',
  'HOUR_METER',
  'DELIVERY_SHEET',
  'TAX_INVOICE',
  'CRM_LEAD',
  'OTHER',
] as const;
export type NtrAttachmentType = (typeof NTR_ATTACHMENT_TYPES)[number];

/** Provenance of the record, independent of `import_session_id` (which is
 *  only ever set for 'legacy_import') - lets a future API integration
 *  mark its own records distinctly from manual dealer entry. */
export type NtrSource = 'manual' | 'legacy_import' | 'api';

export interface NtrAdditionalPhoto {
  url: string;
  label: string;
}

export interface NtrRecord {
  id: string;
  ntr_number: string;
  dealer_id: string;
  branch_id: string | null;
  serial: string;
  model: string | null;
  engine_number: string | null;
  salesperson: string | null;
  receiving_person: string | null;
  customer_title: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  customer_subdistrict: string | null;
  customer_district: string | null;
  customer_province: string | null;
  customer_postal_code: string | null;
  customer_type: NtrCustomerType | null;
  /** References product_families.id - resolved (never duplicated as a
   *  free-text name) whenever the tractor's Product Family is known. */
  product_family_id: string | null;
  variant: string | null;
  retail_date: string | null;
  delivery_date: string;
  pdi_date: string | null;
  manufacturing_year: number | null;
  hour_meter: number | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  google_maps_url: string | null;
  photo_customer_tractor_url: string | null;
  photo_serial_plate_url: string | null;
  photo_hour_meter_url: string | null;
  photo_signed_document_url: string | null;
  additional_photos: NtrAdditionalPhoto[];
  video_url: string | null;
  audio_url: string | null;
  status: string;
  record_status: 'Active' | 'Deleted';
  deleted_by: string | null;
  deleted_at: string | null;
  /** Traceability metadata only, not business logic - see the migration's
   *  own comment. Never branch permission/workflow logic on this field. */
  import_session_id: string | null;
  source: NtrSource;
  created_by: string;
  created_at: string;
  updated_by: string | null;
  updated_at: string;
}

/** Shape accepted when registering a tractor via the search-first
 *  workflow. `dealer_id` is resolved server-side from the session (never
 *  trusted from the client), same zero-leakage principle as every other
 *  create path in this app - it is listed here because the Repository
 *  layer still needs it to build the insert payload. */
export type NtrRecordCreateInput = Pick<
  NtrRecord,
  | 'dealer_id'
  | 'branch_id'
  | 'serial'
  | 'model'
  | 'engine_number'
  | 'salesperson'
  | 'receiving_person'
  | 'customer_title'
  | 'customer_first_name'
  | 'customer_last_name'
  | 'customer_name'
  | 'customer_phone'
  | 'customer_address'
  | 'customer_subdistrict'
  | 'customer_district'
  | 'customer_province'
  | 'customer_postal_code'
  | 'customer_type'
  | 'product_family_id'
  | 'variant'
  | 'retail_date'
  | 'delivery_date'
  | 'pdi_date'
  | 'manufacturing_year'
  | 'hour_meter'
  | 'photo_customer_tractor_url'
  | 'photo_serial_plate_url'
  | 'photo_hour_meter_url'
  | 'photo_signed_document_url'
  | 'video_url'
  | 'audio_url'
> & {
  latitude?: number | null;
  longitude?: number | null;
  gps_accuracy?: number | null;
  google_maps_url?: string | null;
  additional_photos?: NtrAdditionalPhoto[];
  /** Set only by the Legacy Import service - never accepted from a
   *  regular create request body. */
  source?: NtrSource;
  import_session_id?: string | null;
};

/** Shape accepted when editing an existing registration. All fields
 *  optional (partial patch) - `serial`/`dealer_id`/`ntr_number` are never
 *  editable (the tractor and its dealer of record don't change after
 *  registration; a mistake here is corrected by deleting and
 *  re-registering, matching how MQR/PM handle a wrong-vehicle mistake). */
export type NtrRecordUpdateInput = Partial<
  Pick<
    NtrRecord,
    | 'branch_id'
    | 'salesperson'
    | 'receiving_person'
    | 'customer_title'
    | 'customer_first_name'
    | 'customer_last_name'
    | 'customer_name'
    | 'customer_phone'
    | 'customer_address'
    | 'customer_subdistrict'
    | 'customer_district'
    | 'customer_province'
    | 'customer_postal_code'
    | 'customer_type'
    | 'product_family_id'
    | 'variant'
    | 'retail_date'
    | 'delivery_date'
    | 'pdi_date'
    | 'manufacturing_year'
    | 'hour_meter'
    | 'latitude'
    | 'longitude'
    | 'gps_accuracy'
    | 'google_maps_url'
    | 'photo_customer_tractor_url'
    | 'photo_serial_plate_url'
    | 'photo_hour_meter_url'
    | 'photo_signed_document_url'
    | 'additional_photos'
    | 'video_url'
    | 'audio_url'
    | 'status'
  >
>;

/** Server-side paginated/filtered/sorted/searchable query for the Tractor
 *  Registry - mirrors PM History's `MaintenanceHistoryFilter` shape.
 *  `warrantyStatus` is translated into a `retail_date` threshold using the
 *  same 24-month general-warranty limit `calcWarranty()` already applies
 *  elsewhere (see `lib/warranty.ts`) - not a stored column, so MQR's and
 *  NTR's warranty rule can never silently drift apart. */
export interface NtrHistoryFilter {
  dealerId?: string | null;
  branchId?: string | null;
  model?: string;
  province?: string;
  district?: string;
  retailDateFrom?: string;
  retailDateTo?: string;
  warrantyStatus?: 'in_warranty' | 'out_of_warranty';
  customerName?: string;
  serial?: string;
  status?: string;
  search?: string;
  page: number;
  pageSize: number;
  sortField?: 'created_at' | 'retail_date' | 'ntr_number';
  sortDir?: 'asc' | 'desc';
}

export interface NtrHistoryResult {
  data: NtrRecord[];
  total: number;
}

// Tractor Search / Create result & input types live in `@/lib/db`
// (`NtrTractorSearchResult`, `NtrTractorCreateInput`) alongside every other
// `vehicles`-table query - this module imports them from there rather
// than re-declaring, since `vehicles` is platform-owned, not NTR-owned.

// ---------- Legacy Import ----------

export type NtrImportSessionStatus = 'Pending' | 'Completed' | 'Failed';

export interface NtrImportSession {
  id: string;
  importer: string;
  filename: string;
  original_file_url: string | null;
  status: NtrImportSessionStatus;
  total_records: number;
  valid_count: number;
  duplicate_count: number;
  skipped_count: number;
  failed_count: number;
  errors: NtrImportRowError[];
  started_at: string;
  completed_at: string | null;
  created_by: string;
  updated_by: string | null;
  updated_at: string;
}

export interface NtrImportRowError {
  row: number;
  serial: string | null;
  reason: string;
}

/** One row from the uploaded legacy-import file, after column mapping but
 *  before validation. */
export interface NtrImportRow {
  row: number;
  dealer_id: string;
  branch_id: string | null;
  serial: string;
  model: string | null;
  engine_number: string | null;
  customer_title: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_name: string;
  customer_phone: string;
  customer_address: string | null;
  customer_subdistrict: string | null;
  customer_district: string | null;
  customer_province: string | null;
  customer_postal_code: string | null;
  customer_type: NtrCustomerType | null;
  product_family_id: string | null;
  variant: string | null;
  retail_date: string | null;
  delivery_date: string;
  pdi_date: string | null;
  manufacturing_year: number | null;
  salesperson: string | null;
  receiving_person: string | null;
  hour_meter: number | null;
}

export type NtrImportRowOutcome = 'valid' | 'duplicate' | 'skipped' | 'failed';

export interface NtrImportRowResult {
  row: number;
  serial: string | null;
  outcome: NtrImportRowOutcome;
  reason?: string;
}

/** Nothing is written until the caller confirms - `preview()` only reads
 *  and validates; `commit()` is the only method that writes. */
export interface NtrImportPreview {
  totalRecords: number;
  validCount: number;
  duplicateCount: number;
  skippedCount: number;
  failedCount: number;
  rows: NtrImportRowResult[];
}
