import { z } from 'zod';
import { translate } from '@/lib/i18n/translate';
import { Locale, DEFAULT_LOCALE } from '@/lib/i18n/types';
import { THAI_MOBILE_REGEX } from '@/lib/validation';

/**
 * Coerces "", null, undefined, or a non-string value to `null`; trims a
 * real non-empty string.
 *
 * When a field using this is wrapped in `.optional()` (via `.partial()`
 * on the update schema), zod short-circuits on an absent/undefined key
 * before this preprocessor ever runs - that's what keeps "key omitted
 * from the request body" distinct from "key explicitly sent as null",
 * which the repository's partial-patch logic (`input.field !== undefined`)
 * depends on.
 */
const nullableTrimmedString = z.preprocess(
  (val) => (typeof val === 'string' && val.trim().length > 0 ? val.trim() : null),
  z.string().min(1).nullable()
);

const requiredTrimmedString = (message: string) =>
  z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), z.string().min(1, message));

/**
 * Thai mobile number: 10 digits starting with 0, optionally already
 * formatted with a dash (081-2345678) or plain (0812345678). Strips
 * non-digits, validates the shape, then normalizes to 081-2345678 for
 * storage - matches the spec's "0812345678 -> 081-2345678" requirement
 * server-side too (the UI also live-formats as the technician types, but
 * the API must not trust that alone).
 */
const buildMaintenanceCustomerPhoneSchema = (locale: Locale) =>
  z.preprocess((val) => {
    if (typeof val !== 'string') return val;
    return val.replace(/\D/g, '');
  }, z.string().regex(THAI_MOBILE_REGEX, translate(locale, 'validation.invalidPhone')).transform((digits) => `${digits.slice(0, 3)}-${digits.slice(3)}`));

/**
 * Maintenance Record status - intentionally a loose non-empty string, not a
 * fixed union. Defining a real status workflow is a business-logic decision
 * this module isn't authorized to make yet (see types/index.ts).
 */
const buildMaintenanceRecordStatusSchema = (locale: Locale) =>
  z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().min(1, translate(locale, 'validation.requiredField', { field: translate(locale, 'common.status') }))
  );

/** GPS is optional (per spec); when a numeric value is present it must be
 *  a valid latitude/longitude/non-negative accuracy - null/undefined pass
 *  straight through untouched. */
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

/**
 * Validates the search-first workflow's create body (Phase 2). Everything
 * here is required per the spec's Validation section except `notes`
 * (Remark) and `delivery_date`/`model`/`engine_number` (snapshot fields
 * that may legitimately be null on the source vehicle). `dealer_id` is
 * resolved server-side from the session, never trusted from the client
 * (zero-leakage - see src/app/api/pm-records/route.ts), so it isn't in
 * this schema. `pm_number` is server-generated, also not in this schema.
 */
export const buildMaintenanceRecordCreateBodySchema = (locale: Locale = DEFAULT_LOCALE) =>
  z.object({
    branch_id: nullableTrimmedString,
    serial: requiredTrimmedString(translate(locale, 'validation.selectVehicle')),
    model: nullableTrimmedString,
    delivery_date: nullableTrimmedString,
    engine_number: nullableTrimmedString,
    customer_name: requiredTrimmedString(translate(locale, 'validation.enterCustomerName')),
    customer_phone: buildMaintenanceCustomerPhoneSchema(locale),
    technician_id: requiredTrimmedString(translate(locale, 'validation.selectTechnician')),
    performed_date: requiredTrimmedString(translate(locale, 'validation.specifyPerformedDate')),
    hour_meter: z
      .coerce.number({ invalid_type_error: translate(locale, 'validation.enterHourMeter') })
      .min(0, translate(locale, 'validation.hourMeterNegative')),
    pm_interval_id: requiredTrimmedString(translate(locale, 'validation.selectPmInterval')),
    meter_photo_url: nullableTrimmedString,
    nameplate_photo_url: nullableTrimmedString,
    report_photo_url: requiredTrimmedString(translate(locale, 'validation.uploadReportPhoto')),
    meter_photo_attachment_id: nullableTrimmedString,
    nameplate_photo_attachment_id: nullableTrimmedString,
    report_photo_attachment_id: nullableTrimmedString,
    latitude: buildOptionalLatitude(locale),
    longitude: buildOptionalLongitude(locale),
    gps_accuracy: optionalAccuracy,
    google_maps_url: nullableTrimmedString.optional(),
    notes: nullableTrimmedString,
  });
export type MaintenanceRecordCreateBody = z.infer<ReturnType<typeof buildMaintenanceRecordCreateBodySchema>>;

/**
 * Validates MaintenanceRecordUpdateInput - every field is an optional partial patch.
 */
export const buildMaintenanceRecordUpdateBodySchema = (locale: Locale = DEFAULT_LOCALE) =>
  z
    .object({
      branch_id: nullableTrimmedString,
      serial: nullableTrimmedString,
      technician_id: nullableTrimmedString,
      scheduled_date: nullableTrimmedString,
      performed_date: nullableTrimmedString,
      status: buildMaintenanceRecordStatusSchema(locale),
      notes: nullableTrimmedString,
      customer_name: requiredTrimmedString(translate(locale, 'validation.enterCustomerName')),
      customer_phone: buildMaintenanceCustomerPhoneSchema(locale),
      hour_meter: z.coerce.number().min(0, translate(locale, 'validation.hourMeterNegative')),
      pm_interval_id: nullableTrimmedString,
      meter_photo_url: nullableTrimmedString,
      nameplate_photo_url: nullableTrimmedString,
      report_photo_url: nullableTrimmedString,
      meter_photo_attachment_id: nullableTrimmedString,
      nameplate_photo_attachment_id: nullableTrimmedString,
      report_photo_attachment_id: nullableTrimmedString,
      latitude: buildOptionalLatitude(locale),
      longitude: buildOptionalLongitude(locale),
      gps_accuracy: optionalAccuracy,
      google_maps_url: nullableTrimmedString,
    })
    .partial();
export type MaintenanceRecordUpdateBody = z.infer<ReturnType<typeof buildMaintenanceRecordUpdateBodySchema>>;
