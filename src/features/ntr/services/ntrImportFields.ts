/**
 * NTR — Import Wizard field definitions.
 *
 * The one NTR-specific piece the Universal Import Framework
 * (`src/shared/import/`) is parameterized by - every alias a dealer's
 * spreadsheet might use for each column, whether it's required, and how
 * to coerce its raw cell text into the type `NtrImportRow` expects.
 * Extending this list (a future column, a new alias) never requires
 * touching the shared framework or the generic parser - only this file
 * and, if the field is genuinely new, `NtrImportRow`/`ntrImportService.ts`.
 */
import { ImportContract, ImportFieldDefinition, ImportTemplateMeta } from '@/shared/import';
import { MasterDataService } from '@/shared/master-data';

export const NTR_IMPORT_TEMPLATE_META: ImportTemplateMeta = {
  module: 'ntr',
  templateName: 'NTR Legacy Import Template',
  templateVersion: '1.2',
};

const toNumberOrNull = (raw: string): number | null => (raw.trim() ? Number(raw.trim()) : null);
const toStringOrNull = (raw: string): string | null => (raw.trim() ? raw.trim() : null);

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Real dealer spreadsheets have been seen using "31 Oct 2025"/"31 October
 *  2025", "31/10/2025", and "31-10-2025" alongside already-ISO dates -
 *  normalizes any of those to ISO `YYYY-MM-DD`, the format every downstream
 *  consumer assumes (`calcWarranty()`, the manual-entry `<input
 *  type="date">`). Returns `null` for anything else, so an unparseable
 *  date fails validation as a missing/invalid field (delivery_date is
 *  required - see `ntrImportService.ts`'s `isBlankRow`/preview checks)
 *  rather than being stored as garbage text. */
export function parseImportDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const dmyName = value.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/);
  if (dmyName) {
    const day = Number(dmyName[1]);
    const month = MONTH_NAMES[dmyName[2].toLowerCase()];
    const year = Number(dmyName[3]);
    if (!month || day < 1 || day > 31) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  const dmySlash = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmySlash) {
    const day = Number(dmySlash[1]);
    const month = Number(dmySlash[2]);
    const year = Number(dmySlash[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }

  return null;
}

export const NTR_IMPORT_FIELDS: ImportFieldDefinition[] = [
  { canonicalKey: 'dealer_id', displayLabel: 'Dealer Code', required: true, aliases: ['Dealer', 'Dealer_ID', 'DealerCode', 'dealer_code'] },
  { canonicalKey: 'branch_id', displayLabel: 'Branch', required: false, aliases: ['Branch_ID', 'BranchCode', 'branch_code'], parse: toStringOrNull },
  {
    canonicalKey: 'serial',
    displayLabel: 'Product Serial Number',
    required: true,
    aliases: ['Serial Number', 'Vehicle Serial', 'Serial', 'Product Serial', 'Tractor Serial Number'],
  },
  { canonicalKey: 'model', displayLabel: 'Model', required: true, aliases: ['Tractor Model', 'ModelDescription'] },
  { canonicalKey: 'engine_number', displayLabel: 'Engine Number', required: false, aliases: ['Engine No', 'Engine No.', 'EngineNumber'], parse: toStringOrNull },
  {
    canonicalKey: 'customer_name',
    displayLabel: 'Customer Name',
    required: false,
    aliases: ['Customer', 'Customer Full Name'],
  },
  {
    canonicalKey: 'customer_phone',
    displayLabel: 'Customer Phone',
    required: true,
    aliases: ['Phone', 'Customer Mobile', 'Mobile Number', 'Mobile', 'Phone Number'],
  },
  { canonicalKey: 'customer_address', displayLabel: 'Address', required: true, aliases: ['Address', 'Customer Address'] },
  {
    canonicalKey: 'customer_district',
    displayLabel: 'District',
    required: true,
    aliases: ['Customer District', 'Amphoe', 'City'],
  },
  {
    canonicalKey: 'customer_province',
    displayLabel: 'Province',
    required: true,
    aliases: ['Customer Province', 'State'],
  },
  { canonicalKey: 'customer_postal_code', displayLabel: 'Postal Code', required: false, aliases: ['Zip Code', 'Zip'], parse: toStringOrNull },
  {
    canonicalKey: 'customer_type',
    displayLabel: 'Customer Type',
    required: false,
    aliases: ['Type'],
    parse: (raw) => (raw.trim() ? MasterDataService.normalizeCustomerType(raw) : null),
  },
  { canonicalKey: 'retail_date', displayLabel: 'Retail Date', required: true, aliases: ['Retail Date'], parse: parseImportDate },
  {
    canonicalKey: 'delivery_date',
    displayLabel: 'Acceptance Date',
    required: true,
    aliases: ['Delivery Date', 'Retail Date (Acceptance)', 'NTR Date'],
    parse: parseImportDate,
  },
  { canonicalKey: 'salesperson', displayLabel: 'Salesperson', required: false, aliases: ['Sales Person'], parse: toStringOrNull },
  { canonicalKey: 'receiving_person', displayLabel: 'Receiving Person', required: false, aliases: ['Received By'], parse: toStringOrNull },
  { canonicalKey: 'hour_meter', displayLabel: 'Hour Meter', required: true, aliases: ['Hours', 'Hour Meter Reading'], parse: toNumberOrNull },
  { canonicalKey: 'customer_title', displayLabel: 'Customer Title', required: true, aliases: ['Title', 'Prefix'] },
  { canonicalKey: 'customer_first_name', displayLabel: 'Customer First Name', required: true, aliases: ['First Name'] },
  { canonicalKey: 'customer_last_name', displayLabel: 'Customer Last Name', required: true, aliases: ['Last Name'] },
  {
    canonicalKey: 'customer_subdistrict',
    displayLabel: 'Sub-District',
    required: true,
    aliases: ['Subdistrict', 'Tambon'],
  },
  {
    canonicalKey: 'product_family_id',
    displayLabel: 'Product Family',
    required: false,
    aliases: ['Product Family ID', 'ProductFamily'],
    parse: toStringOrNull,
  },
  { canonicalKey: 'variant', displayLabel: 'Variant', required: false, aliases: [], parse: toStringOrNull },
  { canonicalKey: 'pdi_date', displayLabel: 'PDI Date', required: false, aliases: [], parse: toStringOrNull },
  { canonicalKey: 'pdi_number', displayLabel: 'PDI Number', required: false, aliases: ['PDI No', 'PDI No.'], parse: toStringOrNull },
  {
    canonicalKey: 'manufacturing_year',
    displayLabel: 'Manufacturing Year',
    required: false,
    aliases: ['Mfg Year', 'Year of Manufacture'],
    parse: toNumberOrNull,
  },
];

/** The single object every generic framework piece (`ColumnMappingService`,
 *  `ImportParser`'s column resolution, `ImportTemplateService`,
 *  `ImportTemplateValidator`) actually depends on - `NTR_IMPORT_FIELDS`/
 *  `NTR_IMPORT_TEMPLATE_META` above are kept separately exported only
 *  because a couple of call sites (`ntrImportService.ts`'s error-label
 *  map) need just the field list, not the whole contract. */
export const NTR_IMPORT_CONTRACT: ImportContract = {
  module: NTR_IMPORT_TEMPLATE_META.module,
  templateName: NTR_IMPORT_TEMPLATE_META.templateName,
  templateVersion: NTR_IMPORT_TEMPLATE_META.templateVersion,
  fields: NTR_IMPORT_FIELDS,
};

export const NTR_IMPORT_INSTRUCTIONS = [
  { field: 'Dealer Code', note: 'Required. Must match an existing Dealer Code exactly.' },
  { field: 'Branch', note: 'Optional. Branch UUID, if known.' },
  { field: 'Product Serial Number', note: 'Required. Tractor serial number - a new Tractor is created automatically if none exists yet.' },
  { field: 'Model', note: 'Required. Tractor model name.' },
  { field: 'Engine Number', note: 'Optional.' },
  { field: 'Customer Name', note: 'Optional - composed automatically from Customer Title/First Name/Last Name if left blank.' },
  { field: 'Customer Phone', note: 'Required. Thai mobile format, 10 digits starting with 0.' },
  { field: 'Address', note: 'Required.' },
  { field: 'District', note: 'Required.' },
  { field: 'Province', note: 'Required.' },
  { field: 'Postal Code', note: 'Optional.' },
  { field: 'Customer Type', note: 'Optional. Individual / Company (or Thai บุคคลธรรมดา / นิติบุคคล).' },
  { field: 'Retail Date', note: 'Required. ISO YYYY-MM-DD, "31 Oct 2025", or 31/10/2025.' },
  { field: 'Acceptance Date', note: 'Required - when the customer took delivery. ISO YYYY-MM-DD, "31 Oct 2025", or 31/10/2025.' },
  { field: 'Salesperson', note: 'Optional.' },
  { field: 'Receiving Person', note: 'Optional.' },
  { field: 'Hour Meter', note: 'Required, numeric.' },
  { field: 'Customer Title', note: 'Required.' },
  { field: 'Customer First Name', note: 'Required.' },
  { field: 'Customer Last Name', note: 'Required.' },
  { field: 'Sub-District', note: 'Required.' },
  { field: 'Product Family', note: 'Optional - must be an existing Product Family UUID, looked up via /admin/product-families.' },
  { field: 'Variant', note: 'Optional, free text.' },
  { field: 'PDI Date', note: 'Optional, ISO YYYY-MM-DD.' },
  { field: 'PDI Number', note: 'Optional, free text.' },
  { field: 'Manufacturing Year', note: 'Optional, 4-digit year.' },
];
