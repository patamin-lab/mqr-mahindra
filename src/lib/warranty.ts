export interface WarrantyResult {
  status: 'อยู่ในประกัน' | 'พ้นประกัน' | 'ไม่ระบุวันที่ส่งมอบ';
  ageMonths: number | null;
  limitMonths: number;
}

/**
 * Replicates the original Apps Script _warranty() business rule:
 * powertrain systems (engine/transmission/hydraulic) get 48 months,
 * everything else gets 24 months, measured from delivery_date to found_date.
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
