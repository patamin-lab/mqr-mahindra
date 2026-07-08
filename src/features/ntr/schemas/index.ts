import { z } from 'zod';
import { translate } from '@/lib/i18n/translate';
import { Locale, DEFAULT_LOCALE } from '@/lib/i18n/types';
import { NTR_ATTACHMENT_TYPES } from '../types';

/** Same preprocessors as `src/features/maintenance/schemas/index.ts` -
 *  reused verbatim rather than redefined, so "" / null / undefined all
 *  normalize identically across every module's update-body schema. */
const nullableTrimmedString = z.preprocess(
  (val) => (typeof val === 'string' && val.trim().length > 0 ? val.trim() : null),
  z.string().min(1).nullable()
);

const requiredTrimmedString = (message: string) =>
  z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), z.string().min(1, message));

const buildNtrCustomerPhoneSchema = (locale: Locale) =>
  z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    return val.replace(/\D/g, '');
  }, z.string().regex(/^0\d{9}$/, translate(locale, 'validation.invalidPhone')).transform((digits) => `${digits.slice(0, 3)}-${digits.slice(3)}`));

const buildOptionalLatitude = (locale: Locale) =>
  z
    .union([
      z.coerce.number().min(-90, translate(locale, 'validation.invalidLatitude')).max(90, translate(locale, 'validation.invalidLatitude')),
      z.null(),
      z.undefined(),
    ])
    .optional();
const buildOptionalLongitude = (locale: Locale) =>
  z
    .union([
      z.coerce.number().min(-180, translate(locale, 'validation.invalidLongitude')).max(180, translate(locale, 'validation.invalidLongitude')),
      z.null(),
      z.undefined(),
    ])
    .optional();
const optionalAccuracy = z.union([z.coerce.number().min(0), z.null(), z.undefined()]).optional();

/** Nullable, never undefined (matches every other optional field's
 *  convention above) - manufacturing year, when given, must be a
 *  plausible calendar year, not an arbitrary integer. */
const optionalManufacturingYear = z.preprocess(
  (val) => (val === undefined || val === null || val === '' ? null : val),
  z.union([z.coerce.number().int().min(1980).max(new Date().getFullYear() + 1), z.null()])
);

/** Normalizes an absent/unrecognized value to `null` (never `undefined`),
 *  matching the `nullableTrimmedString` convention above so downstream
 *  types stay `NtrCustomerType | null`, never `| undefined`. */
const customerTypeSchema = z.preprocess(
  (val) => (val === 'Individual' || val === 'Company' ? val : null),
  z.union([z.literal('Individual'), z.literal('Company'), z.null()])
);

/** `additional_photos` entries hold the optional, no-dedicated-column
 *  attachment categories (Booking Document, Tax Invoice, CRM Lead
 *  Screenshot, ...) - `type` is optional/nullable only for back-compat,
 *  every new write always sets it. */
const additionalPhotoSchema = z.object({
  url: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(NTR_ATTACHMENT_TYPES).optional(),
  attachmentId: nullableTrimmedString.optional(),
});

/**
 * Validates the search-first NTR registration body. `dealer_id` is
 * resolved server-side from the session (zero-leakage, same as every
 * other create route), never trusted from the client, so it isn't in this
 * schema. `ntr_number` is server-generated, also not in this schema.
 * The four required attachments (Customer ID Card, Serial Plate, Hour
 * Meter, Delivery Handover Document) are required strings here, per spec;
 * Customer with Tractor / `additional_photos` / video / audio are optional.
 */
export const buildNtrRecordCreateBodySchema = (locale: Locale = DEFAULT_LOCALE) =>
  z.object({
    branch_id: nullableTrimmedString,
    serial: requiredTrimmedString(translate(locale, 'validation.selectVehicle')),
    model: nullableTrimmedString,
    engine_number: nullableTrimmedString,
    salesperson: nullableTrimmedString,
    receiving_person: nullableTrimmedString,
    customer_title: nullableTrimmedString,
    customer_first_name: nullableTrimmedString,
    customer_last_name: nullableTrimmedString,
    customer_name: requiredTrimmedString(translate(locale, 'validation.enterCustomerName')),
    customer_phone: buildNtrCustomerPhoneSchema(locale),
    customer_address: nullableTrimmedString,
    customer_subdistrict: nullableTrimmedString,
    customer_district: nullableTrimmedString,
    customer_province: nullableTrimmedString,
    customer_postal_code: nullableTrimmedString,
    customer_type: customerTypeSchema,
    product_family_id: nullableTrimmedString,
    variant: nullableTrimmedString,
    retail_date: nullableTrimmedString,
    delivery_date: requiredTrimmedString(translate(locale, 'validation.specifyDeliveryDate')),
    pdi_date: nullableTrimmedString,
    pdi_number: nullableTrimmedString,
    manufacturing_year: optionalManufacturingYear,
    hour_meter: z.preprocess(
      (val) => (val === undefined || val === null || val === '' ? null : val),
      z.union([z.coerce.number().min(0, translate(locale, 'validation.hourMeterNegative')), z.null()])
    ),
    photo_customer_id_url: requiredTrimmedString(translate(locale, 'validation.uploadCustomerIdPhoto')),
    photo_customer_tractor_url: nullableTrimmedString,
    photo_serial_plate_url: requiredTrimmedString(translate(locale, 'validation.uploadSerialPlatePhoto')),
    photo_hour_meter_url: requiredTrimmedString(translate(locale, 'validation.uploadHourMeterPhoto')),
    photo_signed_document_url: requiredTrimmedString(translate(locale, 'validation.uploadSignedDocumentPhoto')),
    photo_customer_id_attachment_id: nullableTrimmedString.optional(),
    photo_customer_tractor_attachment_id: nullableTrimmedString.optional(),
    photo_serial_plate_attachment_id: nullableTrimmedString.optional(),
    photo_hour_meter_attachment_id: nullableTrimmedString.optional(),
    photo_signed_document_attachment_id: nullableTrimmedString.optional(),
    additional_photos: z.preprocess((val) => (Array.isArray(val) ? val : []), z.array(additionalPhotoSchema)),
    video_url: nullableTrimmedString,
    video_attachment_id: nullableTrimmedString.optional(),
    audio_url: nullableTrimmedString,
    latitude: buildOptionalLatitude(locale),
    longitude: buildOptionalLongitude(locale),
    gps_accuracy: optionalAccuracy,
    google_maps_url: nullableTrimmedString,
  });
export type NtrRecordCreateBody = z.infer<ReturnType<typeof buildNtrRecordCreateBodySchema>>;

/** Validates NtrRecordUpdateInput - every field is an optional partial patch. */
export const buildNtrRecordUpdateBodySchema = (locale: Locale = DEFAULT_LOCALE) =>
  z
    .object({
      branch_id: nullableTrimmedString,
      salesperson: nullableTrimmedString,
      receiving_person: nullableTrimmedString,
      customer_title: nullableTrimmedString,
      customer_first_name: nullableTrimmedString,
      customer_last_name: nullableTrimmedString,
      customer_name: requiredTrimmedString(translate(locale, 'validation.enterCustomerName')),
      customer_phone: buildNtrCustomerPhoneSchema(locale),
      customer_address: nullableTrimmedString,
      customer_subdistrict: nullableTrimmedString,
      customer_district: nullableTrimmedString,
      customer_province: nullableTrimmedString,
      customer_postal_code: nullableTrimmedString,
      customer_type: customerTypeSchema,
      product_family_id: nullableTrimmedString,
      variant: nullableTrimmedString,
      retail_date: nullableTrimmedString,
      delivery_date: requiredTrimmedString(translate(locale, 'validation.specifyDeliveryDate')),
      pdi_date: nullableTrimmedString,
      pdi_number: nullableTrimmedString,
      manufacturing_year: optionalManufacturingYear,
      hour_meter: z.coerce.number().min(0, translate(locale, 'validation.hourMeterNegative')),
      latitude: buildOptionalLatitude(locale),
      longitude: buildOptionalLongitude(locale),
      gps_accuracy: optionalAccuracy,
      google_maps_url: nullableTrimmedString,
      photo_customer_id_url: nullableTrimmedString,
      photo_customer_tractor_url: nullableTrimmedString,
      photo_serial_plate_url: nullableTrimmedString,
      photo_hour_meter_url: nullableTrimmedString,
      photo_signed_document_url: nullableTrimmedString,
      photo_customer_id_attachment_id: nullableTrimmedString,
      photo_customer_tractor_attachment_id: nullableTrimmedString,
      photo_serial_plate_attachment_id: nullableTrimmedString,
      photo_hour_meter_attachment_id: nullableTrimmedString,
      photo_signed_document_attachment_id: nullableTrimmedString,
      additional_photos: z.array(additionalPhotoSchema),
      video_url: nullableTrimmedString,
      video_attachment_id: nullableTrimmedString,
      audio_url: nullableTrimmedString,
      status: z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), z.string().min(1)),
    })
    .partial();
export type NtrRecordUpdateBody = z.infer<ReturnType<typeof buildNtrRecordUpdateBodySchema>>;

/** Validates a "Create Tractor" request (no existing `vehicles` row
 *  matched the search) - `dealer_id` again resolved server-side. */
export const buildTractorCreateBodySchema = (locale: Locale = DEFAULT_LOCALE) =>
  z.object({
    serial: requiredTrimmedString(translate(locale, 'validation.selectVehicle')),
    model: nullableTrimmedString,
    engine_number: nullableTrimmedString,
    branch_id: nullableTrimmedString,
    delivery_date: nullableTrimmedString,
  });
export type TractorCreateBody = z.infer<ReturnType<typeof buildTractorCreateBodySchema>>;
