/**
 * Universal Import Framework — downloadable template generator (Step 1).
 *
 * Produces one `.xlsx` workbook with exactly the three sheets the spec
 * requires: an Instructions sheet (human-readable field guide), a Data
 * sheet (the actual header row a dealer fills in), and a `_META` sheet
 * (module/version/generated-date, read back by `ImportTemplateValidator`
 * on upload). Depends only on `ImportContract` - no NTR-specific (or any
 * module-specific) text lives here.
 */
import ExcelJS from 'exceljs';
import { ImportContract } from './ImportContract';
import { APP_NAME } from '@/lib/branding';

export interface BuildTemplateOptions {
  contract: ImportContract;
  /** One instruction line per field, shown in the Instructions sheet next
   *  to its column header - module-supplied so this file stays
   *  business-content-free. */
  instructions: { field: string; note: string }[];
}

export async function buildImportTemplate(options: BuildTemplateOptions): Promise<Buffer> {
  const { contract } = options;
  const wb = new ExcelJS.Workbook();
  wb.creator = APP_NAME;
  wb.created = new Date();

  const instructionsSheet = wb.addWorksheet('Instructions');
  instructionsSheet.columns = [
    { header: 'Column', key: 'field', width: 28 },
    { header: 'Required', key: 'required', width: 12 },
    { header: 'Notes', key: 'note', width: 80 },
  ];
  instructionsSheet.getRow(1).font = { bold: true };
  const requiredByKey = new Map(contract.fields.map((f) => [f.displayLabel, f.required]));
  for (const line of options.instructions) {
    instructionsSheet.addRow({
      field: line.field,
      required: requiredByKey.get(line.field) ? 'Required' : 'Optional',
      note: line.note,
    });
  }

  const dataSheet = wb.addWorksheet('Data');
  dataSheet.columns = contract.fields.map((f) => ({ header: f.displayLabel, key: f.canonicalKey, width: 22 }));
  dataSheet.getRow(1).font = { bold: true };

  const metaSheet = wb.addWorksheet('_META');
  metaSheet.columns = [
    { header: 'Key', key: 'key', width: 20 },
    { header: 'Value', key: 'value', width: 40 },
  ];
  metaSheet.addRows([
    { key: 'Template Name', value: contract.templateName },
    { key: 'Template Version', value: contract.templateVersion },
    { key: 'Module', value: contract.module },
    { key: 'Generated Date', value: new Date().toISOString() },
  ]);

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
