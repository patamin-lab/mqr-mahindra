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
import { ImportFieldDefinition, ImportTemplateMeta } from '@/shared/import';
import { NtrCustomerType } from '../types';

export const NTR_IMPORT_TEMPLATE_META: ImportTemplateMeta = {
  module: 'ntr',
  templateName: 'NTR Legacy Import Template',
  templateVersion: '1.1',
};

function normalizeCustomerType(value: string): NtrCustomerType | null {
  const v = value.trim().toLowerCase();
  if (v === 'individual' || v === 'บุคคลธรรมดา') return 'Individual';
  if (v === 'company' || v === 'นิติบุคคล') return 'Company';
  return null;
}

const toNumberOrNull = (raw: string): number | null => (raw.trim() ? Number(raw.trim()) : null);
const toStringOrNull = (raw: string): string | null => (raw.trim() ? raw.trim() : null);

export const NTR_IMPORT_FIELDS: ImportFieldDefinition[] = [
  { canonicalKey: 'dealer_id', displayLabel: 'Dealer Code', required: true, aliases: ['Dealer', 'Dealer_ID', 'DealerCode', 'dealer_code'] },
  { canonicalKey: 'branch_id', displayLabel: 'Branch', required: false, aliases: ['Branch_ID', 'BranchCode', 'branch_code'], parse: toStringOrNull },
  {
    canonicalKey: 'serial',
    displayLabel: 'Product Serial Number',
    required: true,
    aliases: ['Serial Number', 'Vehicle Serial', 'Serial', 'Product Serial'],
  },
  { canonicalKey: 'model', displayLabel: 'Model', required: false, aliases: ['Tractor Model'], parse: toStringOrNull },
  { canonicalKey: 'engine_number', displayLabel: 'Engine Number', required: true, aliases: ['Engine No', 'Engine No.', 'EngineNumber'] },
  {
    canonicalKey: 'customer_name',
    displayLabel: 'Customer Name',
    required: false,
    aliases: ['Customer', 'Customer Full Name'],
  },
  { canonicalKey: 'customer_phone', displayLabel: 'Customer Phone', required: true, aliases: ['Phone', 'Customer Mobile', 'Mobile Number'] },
  { canonicalKey: 'customer_address', displayLabel: 'Customer Address', required: false, aliases: ['Address'], parse: toStringOrNull },
  { canonicalKey: 'customer_district', displayLabel: 'District', required: false, aliases: ['Customer District', 'Amphoe'], parse: toStringOrNull },
  { canonicalKey: 'customer_province', displayLabel: 'Province', required: false, aliases: ['Customer Province'], parse: toStringOrNull },
  { canonicalKey: 'customer_postal_code', displayLabel: 'Postal Code', required: false, aliases: ['Zip Code', 'Zip'], parse: toStringOrNull },
  {
    canonicalKey: 'customer_type',
    displayLabel: 'Customer Type',
    required: false,
    aliases: ['Type'],
    parse: (raw) => (raw.trim() ? normalizeCustomerType(raw) : null),
  },
  { canonicalKey: 'retail_date', displayLabel: 'Retail Date', required: false, aliases: [], parse: toStringOrNull },
  {
    canonicalKey: 'delivery_date',
    displayLabel: 'Acceptance Date',
    required: true,
    aliases: ['Delivery Date', 'Retail Date (Acceptance)'],
  },
  { canonicalKey: 'salesperson', displayLabel: 'Salesperson', required: false, aliases: ['Sales Person'], parse: toStringOrNull },
  { canonicalKey: 'receiving_person', displayLabel: 'Receiving Person', required: false, aliases: ['Received By'], parse: toStringOrNull },
  { canonicalKey: 'hour_meter', displayLabel: 'Hour Meter', required: false, aliases: ['Hours', 'Hour Meter Reading'], parse: toNumberOrNull },
  { canonicalKey: 'customer_title', displayLabel: 'Customer Title', required: false, aliases: ['Title', 'Prefix'], parse: toStringOrNull },
  { canonicalKey: 'customer_first_name', displayLabel: 'Customer First Name', required: false, aliases: ['First Name'], parse: toStringOrNull },
  { canonicalKey: 'customer_last_name', displayLabel: 'Customer Last Name', required: false, aliases: ['Last Name'], parse: toStringOrNull },
  {
    canonicalKey: 'customer_subdistrict',
    displayLabel: 'Sub-District',
    required: false,
    aliases: ['Subdistrict', 'Tambon'],
    parse: toStringOrNull,
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
  {
    canonicalKey: 'manufacturing_year',
    displayLabel: 'Manufacturing Year',
    required: false,
    aliases: ['Mfg Year', 'Year of Manufacture'],
    parse: toNumberOrNull,
  },
];

export const NTR_IMPORT_INSTRUCTIONS = [
  { field: 'Dealer Code', note: 'Must match an existing Dealer Code exactly.' },
  { field: 'Branch', note: 'Branch UUID, if known.' },
  { field: 'Product Serial Number', note: 'Tractor serial number - a new Tractor is created automatically if none exists yet.' },
  { field: 'Model', note: 'Tractor model name.' },
  { field: 'Engine Number', note: 'Required.' },
  { field: 'Customer Name', note: 'Required unless Customer Title/First Name/Last Name are filled instead.' },
  { field: 'Customer Phone', note: 'Thai mobile format, 10 digits starting with 0.' },
  { field: 'Customer Address', note: 'Optional.' },
  { field: 'District', note: 'Optional.' },
  { field: 'Province', note: 'Optional.' },
  { field: 'Postal Code', note: 'Optional.' },
  { field: 'Customer Type', note: 'Individual / Company (or Thai บุคคลธรรมดา / นิติบุคคล).' },
  { field: 'Retail Date', note: 'Optional, ISO YYYY-MM-DD.' },
  { field: 'Acceptance Date', note: 'Required, ISO YYYY-MM-DD - when the customer took delivery.' },
  { field: 'Salesperson', note: 'Optional.' },
  { field: 'Receiving Person', note: 'Optional.' },
  { field: 'Hour Meter', note: 'Optional, numeric.' },
  { field: 'Customer Title', note: 'Optional - one of two ways to provide the customer name (see Customer Name).' },
  { field: 'Customer First Name', note: 'Optional.' },
  { field: 'Customer Last Name', note: 'Optional.' },
  { field: 'Sub-District', note: 'Optional.' },
  { field: 'Product Family', note: 'Optional - must be an existing Product Family UUID, looked up via /admin/product-families.' },
  { field: 'Variant', note: 'Optional, free text.' },
  { field: 'PDI Date', note: 'Optional, ISO YYYY-MM-DD.' },
  { field: 'Manufacturing Year', note: 'Optional, 4-digit year.' },
];
