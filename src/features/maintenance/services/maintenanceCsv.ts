/**
 * Maintenance (PM Record) — CSV export.
 *
 * Reuses the shared buildCsv() helper (UTF-8 BOM + CSV escaping) from
 * lib/exportCsv.ts rather than re-implementing it - only the column
 * mapping here is PM-specific, matching lib/exportCsv.ts's own
 * mqrCsvColumns() pattern. Column headers follow the selected locale
 * (Task 10 requirement 6).
 */
import { buildCsv, CsvColumn } from '@/lib/exportCsv';
import { formatDateTimeLocalized } from '@/lib/thaiDate';
import { translate } from '@/lib/i18n/translate';
import { Locale } from '@/lib/i18n/types';
import { MaintenanceRecord } from '../types';

function pmCsvColumns(locale: Locale): CsvColumn<MaintenanceRecord>[] {
  return [
    { header: translate(locale, 'csv.pmNumber'), value: (r) => r.pm_number },
    { header: translate(locale, 'csv.dealer'), value: (r) => r.dealer_id },
    { header: translate(locale, 'csv.branch'), value: (r) => r.branch_name },
    { header: translate(locale, 'csv.performedDate'), value: (r) => r.performed_date },
    { header: translate(locale, 'csv.model'), value: (r) => r.model },
    { header: translate(locale, 'csv.serial'), value: (r) => r.serial },
    { header: translate(locale, 'csv.engineNumber'), value: (r) => r.engine_number },
    { header: translate(locale, 'csv.customerName'), value: (r) => r.customer_name },
    { header: translate(locale, 'csv.customerPhone'), value: (r) => r.customer_phone },
    { header: translate(locale, 'csv.technicianName'), value: (r) => r.technician_name },
    { header: translate(locale, 'csv.hourMeter'), value: (r) => r.hour_meter },
    { header: translate(locale, 'csv.nextPmDue'), value: (r) => r.next_pm_due },
    { header: translate(locale, 'csv.status'), value: (r) => r.status },
    { header: translate(locale, 'csv.notes'), value: (r) => r.notes },
    { header: translate(locale, 'csv.createdBy'), value: (r) => r.created_by },
    { header: translate(locale, 'csv.createdAt'), value: (r) => (r.created_at ? formatDateTimeLocalized(r.created_at, locale) : '') },
  ];
}

export function buildMaintenanceRecordsCsv(records: MaintenanceRecord[], locale: Locale = 'th'): Buffer {
  return buildCsv(records, pmCsvColumns(locale));
}
