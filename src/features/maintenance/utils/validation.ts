/**
 * Re-exports the shared validation helpers - this file's contents moved to
 * `src/lib/validation.ts` once NTR needed the exact same shape (see that
 * file's header comment). Kept as a re-export, not deleted, so existing
 * imports (`../utils/validation` from this module's own components/routes)
 * don't need to change.
 */
export { ValidationError, isNonEmptyString, parseJsonBody, parseWithSchema } from '@/lib/validation';
