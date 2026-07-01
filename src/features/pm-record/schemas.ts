import { z } from 'zod';

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
const PmCustomerPhoneSchema = z.preprocess((val) => {
  if (typeof val !== 'string') return val;
  return val.replace(/\D/g, '');
}, z.string().regex(/^0\d{9}$/, 'เบอร์โทรศัพท์ไม่ถูกต้อง ต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0').transform((digits) => `${digits.slice(0, 3)}-${digits.slice(3)}`));

/**
 * PM Record status - intentionally a loose non-empty string, not a fixed
 * union. Defining a real status workflow is a business-logic decision this
 * module isn't authorized to make yet (see types.ts).
 */
export const PmRecordStatusSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim() : val),
  z.string().min(1, 'status is required')
);

/**
 * Validates the search-first workflow's create body (Phase 2). Everything
 * here is required per the spec's Validation section except `notes`
 * (Remark) and `delivery_date`/`model`/`engine_number` (snapshot fields
 * that may legitimately be null on the source vehicle). `dealer_id` is
 * resolved server-side from the session, never trusted from the client
 * (zero-leakage - see src/app/api/pm-records/route.ts), so it isn't in
 * this schema. `pm_number` is server-generated, also not in this schema.
 */
export const PmRecordCreateBodySchema = z.object({
  branch_id: nullableTrimmedString,
  serial: requiredTrimmedString('กรุณาเลือกรถแทรกเตอร์'),
  model: nullableTrimmedString,
  delivery_date: nullableTrimmedString,
  engine_number: nullableTrimmedString,
  customer_name: requiredTrimmedString('กรุณากรอกชื่อลูกค้า'),
  customer_phone: PmCustomerPhoneSchema,
  technician_id: requiredTrimmedString('กรุณาเลือกช่างซ่อม'),
  performed_date: requiredTrimmedString('กรุณาระบุวันที่ทำ PM'),
  hour_meter: z.coerce.number({ invalid_type_error: 'กรุณากรอกชั่วโมงเครื่องยนต์' }).min(0, 'ชั่วโมงเครื่องยนต์ต้องไม่ติดลบ'),
  pm_interval_id: requiredTrimmedString('กรุณาเลือกรอบ PM'),
  meter_photo_url: requiredTrimmedString('กรุณาอัปโหลดรูปมิเตอร์ชั่วโมง'),
  nameplate_photo_url: requiredTrimmedString('กรุณาอัปโหลดรูป Nameplate/หมายเลขเครื่อง'),
  report_photo_url: requiredTrimmedString('กรุณาอัปโหลดรูปใบรายงาน PM'),
  notes: nullableTrimmedString,
});
export type PmRecordCreateBody = z.infer<typeof PmRecordCreateBodySchema>;

/**
 * Validates PmRecordUpdateInput - every field is an optional partial patch.
 */
export const PmRecordUpdateBodySchema = z
  .object({
    branch_id: nullableTrimmedString,
    serial: nullableTrimmedString,
    technician_id: nullableTrimmedString,
    scheduled_date: nullableTrimmedString,
    performed_date: nullableTrimmedString,
    status: PmRecordStatusSchema,
    notes: nullableTrimmedString,
    customer_name: requiredTrimmedString('กรุณากรอกชื่อลูกค้า'),
    customer_phone: PmCustomerPhoneSchema,
    hour_meter: z.coerce.number().min(0, 'ชั่วโมงเครื่องยนต์ต้องไม่ติดลบ'),
    pm_interval_id: nullableTrimmedString,
    meter_photo_url: nullableTrimmedString,
    nameplate_photo_url: nullableTrimmedString,
    report_photo_url: nullableTrimmedString,
  })
  .partial();
export type PmRecordUpdateBody = z.infer<typeof PmRecordUpdateBodySchema>;
