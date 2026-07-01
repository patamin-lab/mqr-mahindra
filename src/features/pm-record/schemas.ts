import { z } from 'zod';

/**
 * Coerces "", null, undefined, or a non-string value to `null`; trims a
 * real non-empty string. Matches the coercion the hand-written
 * isNonEmptyString-based checks in the API routes already did, so wiring
 * these schemas into the routes is not a behavior change.
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

/**
 * PM Record status - intentionally a loose non-empty string, not a fixed
 * union. Defining a real status workflow is a business-logic decision this
 * module isn't authorized to make yet (see types.ts).
 */
export const PmRecordStatusSchema = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim() : val),
  z.string().min(1, 'status is required')
);

const pmRecordBodyFields = {
  branch_id: nullableTrimmedString,
  serial: nullableTrimmedString,
  technician_id: nullableTrimmedString,
  scheduled_date: nullableTrimmedString,
  status: PmRecordStatusSchema,
  notes: nullableTrimmedString,
};

/**
 * Validates everything in PmRecordCreateInput except dealer_id - that
 * field is resolved server-side from the session (zero-leakage: a
 * non-privileged actor can never set an arbitrary dealer_id from the
 * request body), not trusted from the client, so it doesn't belong in a
 * body-shape schema. See src/app/api/pm-records/route.ts.
 */
export const PmRecordCreateBodySchema = z.object(pmRecordBodyFields);
export type PmRecordCreateBody = z.infer<typeof PmRecordCreateBodySchema>;

/**
 * Validates PmRecordUpdateInput - every field is an optional partial
 * patch, plus performed_date, which only exists on update (not create).
 */
export const PmRecordUpdateBodySchema = z
  .object({
    ...pmRecordBodyFields,
    performed_date: nullableTrimmedString,
  })
  .partial();
export type PmRecordUpdateBody = z.infer<typeof PmRecordUpdateBodySchema>;
