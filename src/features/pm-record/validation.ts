/**
 * PM Record — shared validation utilities.
 *
 * No shared validation helper module exists anywhere else in this repo
 * (every route hand-rolls its own checks - flagged previously as
 * technical debt). These helpers are intentionally generic (not PM-Record
 * business rules) so they can be lifted out to a repo-wide module later
 * without rework, but are kept scoped to this feature for now rather than
 * changing `src/lib/` conventions for the whole app in this sprint.
 */
import { z } from 'zod';

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string; issues: string[] };

/**
 * Runs a Zod schema and normalizes the result into the same `{ ok, ... }`
 * shape every existing API route already returns (see
 * src/app/api/admin/problem-codes/route.ts), so route handlers can do:
 *
 *   const result = parseWithSchema(pmRecordCreateSchema, body);
 *   if (!result.ok) return NextResponse.json(result, { status: 400 });
 */
export function parseWithSchema<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };

  const issues = result.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`);
  return { ok: false, error: 'validation failed', issues };
}

/** Safely parses a request body as JSON, returning null instead of throwing
 *  on malformed input (every route currently repeats this pattern inline). */
export async function parseJsonBody(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
