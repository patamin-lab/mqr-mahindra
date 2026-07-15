import { redirect } from 'next/navigation';

interface RouteParams {
  params: { serial: string };
}

/** Vehicle 360 consolidation (ADR-030): this route used to render its own,
 *  near-duplicate subset of Machine Passport's Identity/Health/Timeline/
 *  Attachments (same `MachineService` calls, less coverage - no Warranty/
 *  PM/Quality/Delivery/Import Inspection/NTR/Related Records/Knowledge/
 *  Activity). Machine Passport (`/machines/[machineId]`) is now the one
 *  Vehicle 360 destination; this URL just forwards old links/bookmarks
 *  there rather than keeping a second implementation alive. */
export default function VehiclesSerialRedirectPage({ params }: RouteParams) {
  redirect(`/machines/${encodeURIComponent(params.serial)}`);
}
