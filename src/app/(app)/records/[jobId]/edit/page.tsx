import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getRecordByJobId, listProblemCodes } from '@/lib/db';
import { MasterDataService } from '@/shared/master-data';
import { canUpdateStatus } from '@/lib/scope';
import { AttachmentService } from '@/shared/attachments';
import ReportForm from '../../../report/report-form';

const attachmentService = new AttachmentService();

/**
 * Edit Report - reuses the manual create form (`ReportForm`) in edit mode,
 * prefilled from the existing record, saving via `PATCH /api/records/[jobId]`
 * instead of `POST /api/records`. Gated by the same `canUpdateStatus`
 * permission already enforced for the Update Status section on the detail
 * page and by the PATCH route itself (server-side, not just this redirect).
 *
 * Dealer/branch/technician roster are resolved from the *record's* own
 * dealer, not the viewing session's - dealer/branch are read-only in edit
 * mode (job_id already embeds the dealer at creation time), so the roster
 * must match the report's actual dealer regardless of who is editing it.
 */
export default async function EditRecordPage({ params }: { params: { jobId: string } }) {
  const session = await getSession();
  if (!session) return null;

  const jobId = decodeURIComponent(params.jobId);
  const record = await getRecordByJobId(jobId, session);
  if (!record) notFound();

  if (!canUpdateStatus(session.role)) {
    redirect(`/records/${encodeURIComponent(record.job_id)}`);
  }

  // Same fix as the detail page (`records/[jobId]/page.tsx`) and NTR's
  // `resolveNtrAttachmentUrls` - `photo_links[].url`/`video_link` may be a
  // Supabase signed URL that has since expired (1-hour TTL), so it's never
  // trusted directly. Resolve a fresh one here too, or the edit form shows
  // broken thumbnails for every existing photo on a record older than an
  // hour. See `PhotoLink.url`'s own doc comment in `lib/types.ts`.
  record.photo_links = await Promise.all(
    (record.photo_links ?? []).map(async (p) => {
      if (!p.attachmentId) return p;
      const resolved = await attachmentService.getUrl(p.attachmentId).catch(() => null);
      return resolved ? { ...p, url: resolved.url } : p;
    })
  );
  if (record.video_attachment_id) {
    const resolved = await attachmentService.getUrl(record.video_attachment_id).catch(() => null);
    if (resolved) record.video_link = resolved.url;
  }

  const [problemCodes, technicians, dealer, branch] = await Promise.all([
    listProblemCodes(),
    MasterDataService.getTechniciansForDealer(record.dealer_id),
    MasterDataService.getDealerById(record.dealer_id),
    record.branch_id ? MasterDataService.getBranch(record.branch_id) : Promise.resolve(null),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-brand-dark mb-1">แก้ไขรายงานปัญหาคุณภาพ</h1>
      <p className="text-sm text-gray-500 mb-6">
        เลขที่งาน: <span className="font-mono font-semibold">{record.job_id}</span>
      </p>
      <ReportForm
        mode="edit"
        record={record}
        problemCodes={problemCodes}
        dealers={[]}
        role={session.role}
        sessionDealerId={session.dealerId}
        sessionBranchId={session.branchId}
        pinnedDealerName={dealer?.short_name ?? dealer?.full_name}
        pinnedBranchName={branch?.name}
        initialTechnicians={technicians}
      />
    </div>
  );
}
