/**
 * MASP Platform — Lookup Platform: Severity (MQR's priority classification).
 *
 * `Severity`'s canonical values/labels are declared in `lib/types.ts`
 * because `lib/db.ts` (Infrastructure) types its `problem_codes`/`records`
 * queries against it, and Infrastructure may not depend upward on this
 * Platform service (`docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md`'s
 * one-way dependency rule) - so this module re-exports rather than
 * redeclares, the same pattern `reference/referenceData.ts` uses for
 * `lib/db.ts`'s dealer/branch/technician/product-family functions. This
 * is MQR's only priority-like lookup (there is no separate "Priority"
 * field anywhere in the schema), so it is exposed here under both names.
 */
import { SEVERITY_VALUES, SEVERITY_LABELS, type Severity } from '@/lib/types';

export { SEVERITY_VALUES, SEVERITY_LABELS };
export type { Severity };
