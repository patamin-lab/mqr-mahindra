/**
 * MASP Platform — Configuration Platform.
 *
 * The one place a business-rule constant/threshold lives, instead of
 * being hardcoded inline at each call site. Every value here is
 * overridable via an environment variable (read lazily, at call time -
 * matching `lib/supabase.ts`'s established convention - never at module
 * load, so importing this file never throws before env vars are
 * configured) with the existing, already-shipped business rule as the
 * default so behavior is unchanged unless an env var is explicitly set.
 *
 * Today's one real hardcoded business-rule constant this consolidates:
 * the warranty coverage window (`lib/warranty.ts`'s `calcWarranty()`,
 * previously an inline `48 : 24` ternary) - the general/powertrain
 * distinction and both month counts replicate the original Apps Script
 * `_warranty()` rule this platform replaced. PM interval thresholds are
 * NOT here - they were already correctly table-driven
 * (`pm_intervals`/`MaintenanceProgram`), which is the right pattern this
 * Configuration Platform follows, not overrides.
 */

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type WarrantyProblemSystem = 'powertrain' | 'other';

/** Months of warranty coverage for the given problem system - 48 for
 *  powertrain (engine/transmission/hydraulic), 24 for everything else.
 *  Override via `WARRANTY_POWERTRAIN_MONTHS`/`WARRANTY_GENERAL_MONTHS`. */
export function getWarrantyLimitMonths(problemSystem: WarrantyProblemSystem): number {
  return problemSystem === 'powertrain'
    ? envNumber('WARRANTY_POWERTRAIN_MONTHS', 48)
    : envNumber('WARRANTY_GENERAL_MONTHS', 24);
}
