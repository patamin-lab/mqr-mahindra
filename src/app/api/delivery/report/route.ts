import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { canExport } from '@/lib/scope';
import { buildCsv, type CsvColumn } from '@/lib/exportCsv';
import { DeliveryService, type DeliveryReportRow } from '@/features/delivery';

const service = new DeliveryService();

const REPORT_COLUMNS: CsvColumn<DeliveryReportRow>[] = [
  { header: 'Delivery Ref', value: (r) => r.deliveryRef },
  { header: 'Serial', value: (r) => r.serial },
  { header: 'Model', value: (r) => r.model },
  { header: 'Dealer', value: (r) => r.dealerId },
  { header: 'Technician', value: (r) => r.technicianName },
  { header: 'Checklist Version', value: (r) => r.checklistVersion },
  { header: 'PDI Result', value: (r) => r.pdiResult },
  { header: 'Delivery Duration (days)', value: (r) => r.deliveryDurationDays },
  { header: 'Training Completed', value: (r) => (r.trainingCompleted ? 'Yes' : 'No') },
  { header: 'Warranty Activated', value: (r) => (r.warrantyActivated ? 'Yes' : 'No') },
  { header: 'Stage', value: (r) => r.stage },
];

/** One consolidated report satisfying all 7 named report types (Dealer/
 *  Technician/Model/Checklist Version/Delivery Duration/Training
 *  Completion/Warranty Activation) as filters/columns of one dataset -
 *  Reuse-before-Build, not 7 separate report pipelines. `?format=csv`
 *  exports via the existing shared `buildCsv()` (`lib/exportCsv.ts`),
 *  same pattern as `pm-records/history/export`; otherwise returns JSON
 *  for the `/delivery/reports` screen's own table. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const scope = resolveDealerScope(session, searchParams.get('dealerId'));
  const format = searchParams.get('format');

  try {
    const rows = await service.getDeliveryReport({
      dealerId: scope.dealerId ?? undefined,
      technicianName: searchParams.get('technicianName') ?? undefined,
      model: searchParams.get('model') ?? undefined,
      dateFrom: searchParams.get('dateFrom') ?? undefined,
      dateTo: searchParams.get('dateTo') ?? undefined,
    });

    if (format === 'csv') {
      if (!canExport(session.role)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }
      const buf = buildCsv(rows, REPORT_COLUMNS);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="delivery-report.csv"',
        },
      });
    }

    return NextResponse.json({ ok: true, rows });
  } catch (err: any) {
    console.error('delivery report error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'internal error' }, { status: 500 });
  }
}
