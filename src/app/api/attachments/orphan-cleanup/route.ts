import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { OrphanCleanupService } from '@/shared/attachments';

const orphanCleanupService = new OrphanCleanupService();

/**
 * Storage Hygiene entry point (`docs/engineering/STORAGE_HYGIENE.md`) -
 * scans one module for orphan attachments and, only if explicitly asked
 * (`dryRun=false`), cleans up what it found. Callable two ways, per this
 * milestone's requirement:
 *
 * - **Manual execution**: a SuperAdmin hitting this route directly
 *   (authenticated session, same as every other admin-only route in this
 *   app).
 * - **Cron execution**: an external scheduler hitting the same URL. No
 *   scheduler is wired up yet ("do not implement archive scheduling
 *   yet") - this route is ready to be pointed at by one, but there is
 *   deliberately no cron trigger, no `vercel.json` cron entry, and no
 *   service-to-service auth beyond the existing session check. See
 *   STORAGE_HYGIENE.md's Operational Procedure for what a real cron
 *   integration would still need (a service credential, since a cron job
 *   has no browser session cookie).
 *
 * Defaults to `dryRun=true` - a cleanup only ever runs when a caller
 * explicitly asks for it, matching `OrphanCleanupService`'s own "never
 * delete automatically by default."
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== 'SuperAdmin') {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const moduleName = searchParams.get('module');
  if (!moduleName) {
    return NextResponse.json({ ok: false, error: 'module is required' }, { status: 400 });
  }
  const dryRun = searchParams.get('dryRun') !== 'false';
  const retentionHoursParam = searchParams.get('retentionHours');
  const retentionHours = retentionHoursParam ? Number(retentionHoursParam) : undefined;

  try {
    const report = await orphanCleanupService.generateReport(moduleName, retentionHours);
    const result = await orphanCleanupService.cleanup(report, { dryRun });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[orphan-cleanup]', err);
    return NextResponse.json({ ok: false, error: 'Orphan cleanup scan failed' }, { status: 500 });
  }
}
