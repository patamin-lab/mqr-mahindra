export interface WarrantyResult {
  status: 'อยู่ในประกัน' | 'พ้นประกัน' | 'ไม่ระบุวันที่ส่งมอบ';
  ageMonths: number | null;
  limitMonths: number;
}

/**
 * Replicates the original Apps Script _warranty() business rule:
 * powertrain systems (engine/transmission/hydraulic) get 48 months,
 * everything else gets 24 months, measured from delivery_date to found_date.
 *
 * This already is the single source of truth for these two numbers (no
 * duplicate copy exists anywhere else - confirmed via repo-wide search
 * during the MASP Platform build-out) - kept here, in `lib/` rather than
 * threaded through `shared/master-data`'s Configuration Platform, since
 * `lib/` (infrastructure) may not depend upward on `shared/` (platform
 * services) per `docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md`'s one-way
 * dependency rule. `shared/master-data/config/businessConfig.ts` exposes
 * the same two numbers as `getWarrantyLimitMonths()` for business
 * modules that want them without duplicating the 48/24 knowledge
 * themselves - this function is not required to route through it.
 */
export function calcWarranty(
  deliveryDate: string | null | undefined,
  foundDate: string,
  problemSystem: 'powertrain' | 'other'
): WarrantyResult {
  const limitMonths = problemSystem === 'powertrain' ? 48 : 24;

  if (!deliveryDate) {
    return { status: 'ไม่ระบุวันที่ส่งมอบ', ageMonths: null, limitMonths };
  }

  const d = new Date(deliveryDate);
  const f = new Date(foundDate);

  let months = (f.getFullYear() - d.getFullYear()) * 12 + (f.getMonth() - d.getMonth());
  if (f.getDate() < d.getDate()) months -= 1;
  if (months < 0) months = 0;

  const inWarranty = months <= limitMonths;
  return {
    status: inWarranty ? 'อยู่ในประกัน' : 'พ้นประกัน',
    ageMonths: months,
    limitMonths,
  };
}
