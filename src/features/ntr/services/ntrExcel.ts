/**
 * NTR — Tractor Registry Excel export.
 *
 * Reuses the existing ExcelJS-based framework (`exceljs`, already a
 * project dependency via `src/lib/exportExcel.ts`) and its established
 * conventions - bold+shaded header row, frozen header, autofilter,
 * explicit column widths - rather than inventing a second Excel-building
 * approach. Column headers are localized via `translate()`, unlike
 * `exportExcel.ts`'s original MQR sheet (hardcoded Thai, predates the i18n
 * framework) - NTR is new, so it starts fully localized.
 */
import ExcelJS from 'exceljs';
import { NtrRecord } from '../types';
import { formatDateTimeLocalized, formatDateLocalized } from '@/lib/thaiDate';
import { calcWarranty } from '@/lib/warranty';
import { APP_NAME } from '@/lib/branding';
import { translate } from '@/lib/i18n/translate';
import { Locale } from '@/lib/i18n/types';

function columns(locale: Locale): { header: string; key: string; width: number }[] {
  return [
    { header: translate(locale, 'csv.ntrNumber'), key: 'ntr_number', width: 22 },
    { header: translate(locale, 'common.dealer'), key: 'dealer_id', width: 14 },
    { header: translate(locale, 'csv.serial'), key: 'serial', width: 18 },
    { header: translate(locale, 'csv.model'), key: 'model', width: 16 },
    { header: translate(locale, 'csv.engineNumber'), key: 'engine_number', width: 18 },
    { header: translate(locale, 'csv.customerName'), key: 'customer_name', width: 20 },
    { header: translate(locale, 'csv.customerPhone'), key: 'customer_phone', width: 14 },
    { header: translate(locale, 'csv.customerType'), key: 'customer_type', width: 12 },
    { header: translate(locale, 'csv.customerAddress'), key: 'customer_address', width: 26 },
    { header: translate(locale, 'csv.district'), key: 'customer_district', width: 14 },
    { header: translate(locale, 'csv.province'), key: 'customer_province', width: 14 },
    { header: translate(locale, 'csv.postalCode'), key: 'customer_postal_code', width: 10 },
    { header: translate(locale, 'csv.deliveryDate'), key: 'delivery_date', width: 14 },
    { header: translate(locale, 'csv.hourMeter'), key: 'hour_meter', width: 12 },
    { header: translate(locale, 'csv.salesperson'), key: 'salesperson', width: 16 },
    { header: translate(locale, 'csv.receivingPerson'), key: 'receiving_person', width: 16 },
    { header: translate(locale, 'csv.warrantyStatus'), key: 'warranty_status', width: 14 },
    { header: translate(locale, 'csv.status'), key: 'status', width: 12 },
    { header: translate(locale, 'csv.createdBy'), key: 'created_by', width: 16 },
    { header: translate(locale, 'csv.createdAt'), key: 'created_at', width: 18 },
  ];
}

export async function buildTractorRegistryWorkbook(records: NtrRecord[], locale: Locale = 'th'): Promise<ExcelJS.Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = `${APP_NAME} - New Tractor Registration`;
  wb.created = new Date();
  const sheet = wb.addWorksheet(translate(locale, 'nav.ntrRecords'));
  const cols = columns(locale);
  sheet.columns = cols;
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const r of records) {
    // Warranty Start must always equal Customer Delivery Date (see
    // BUSINESS_INVARIANTS.md) - `retail_date` is a legacy/import-only
    // field, null for every manually-registered NTR record.
    const warranty = calcWarranty(r.delivery_date, new Date().toISOString().slice(0, 10), 'other');
    sheet.addRow({
      ntr_number: r.ntr_number,
      dealer_id: r.dealer_id,
      serial: r.serial,
      model: r.model ?? '',
      engine_number: r.engine_number ?? '',
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      customer_type: r.customer_type ?? '',
      customer_address: r.customer_address ?? '',
      customer_district: r.customer_district ?? '',
      customer_province: r.customer_province ?? '',
      customer_postal_code: r.customer_postal_code ?? '',
      delivery_date: formatDateLocalized(r.delivery_date, locale),
      hour_meter: r.hour_meter ?? '',
      salesperson: r.salesperson ?? '',
      receiving_person: r.receiving_person ?? '',
      warranty_status: warranty.status,
      status: r.status,
      created_by: r.created_by,
      created_at: formatDateTimeLocalized(r.created_at, locale),
    });
  }

  const lastCol = String.fromCharCode(64 + cols.length);
  sheet.autoFilter = { from: 'A1', to: `${lastCol}1` };

  return wb.xlsx.writeBuffer();
}
