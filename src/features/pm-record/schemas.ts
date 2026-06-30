import type { PmRecord, PmRecordCreateInput, PmRecordUpdateInput } from './types';

// TODO: Replace with zod runtime schemas when zod is added to the project.
// For now, these are type-level aliases that preserve the intended shape.

export type PmRecordSchema = PmRecord;
export type PmRecordCreateSchema = PmRecordCreateInput;
export type PmRecordUpdateSchema = Partial<PmRecordUpdateInput>;
