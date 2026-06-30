/**
 * PM Record — Zod schemas.
 *
 * Validates the shapes defined in `types.ts`. Foundation only: these
 * schemas are not yet wired into any route or service method (no CRUD
 * exists yet). Field-level rules below are intentionally loose (e.g.
 * `status` accepts any non-empty string) for the same reason the type
 * itself is generic — see `types.ts` and the feature README.
 */
import { z } from 'zod';

/** Same UUID-or-short-code tolerance as existing FK fields elsewhere in the
 *  app (`dealers.id` is a human-assigned text code, not a UUID) - so this is
 *  a plain non-empty string, not `z.string().uuid()`. */
const idLike = z.string().trim().min(1);

const isoDateString = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: 'invalid date' });

export const pmRecordSchema = z.object({
  id: idLike,
  dealer_id: idLike,
  branch_id: idLike.nullable(),
  serial: z.string().trim().min(1).nullable(),
  technician_id: idLike.nullable(),
  scheduled_date: isoDateString.nullable(),
  performed_date: isoDateString.nullable(),
  status: z.string().trim().min(1),
  notes: z.string().nullable(),
  created_by: z.string().nullable(),
  created_at: isoDateString,
  updated_by: z.string().nullable(),
  updated_at: isoDateString,
});

export const pmRecordCreateSchema = z.object({
  dealer_id: idLike,
  branch_id: idLike.nullable(),
  serial: z.string().trim().min(1).nullable(),
  technician_id: idLike.nullable(),
  scheduled_date: isoDateString.nullable(),
  status: z.string().trim().min(1),
  notes: z.string().nullable(),
});

export const pmRecordUpdateSchema = pmRecordCreateSchema
  .omit({ dealer_id: true })
  .extend({ performed_date: isoDateString.nullable() })
  .partial();

export type PmRecordParsed = z.infer<typeof pmRecordSchema>;
export type PmRecordCreateParsed = z.infer<typeof pmRecordCreateSchema>;
export type PmRecordUpdateParsed = z.infer<typeof pmRecordUpdateSchema>;
