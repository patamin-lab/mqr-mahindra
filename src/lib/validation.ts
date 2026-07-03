/**
 * Shared zod-schema validation helpers - originally written for PM
 * (`features/maintenance/utils/validation.ts`), promoted here once NTR
 * needed the exact same schema-parsing shape, per
 * `.claude/rules/01-architecture-boundaries.md` ("shared only once a
 * second module genuinely needs it"). Module-agnostic: no PM- or
 * NTR-specific logic lives here.
 */
import type { ZodTypeAny } from 'zod';

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function parseJsonBody<T>(body: unknown): T {
  return body as T;
}

/** Parses `data` against a zod schema, throwing a `ValidationError` with a
 *  human-readable message (field path + issue) on failure so route
 *  handlers can catch it and map it to a 400 VALIDATION_ERROR response. */
export function parseWithSchema<T>(schema: ZodTypeAny, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue.path.join('.');
    throw new ValidationError(path ? `${path}: ${issue.message}` : issue.message);
  }
  return result.data as T;
}
