import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { listActivePmIntervals } from '@/lib/db';
import { resolveDealerScope, assertBranchAccess } from '@/lib/dealerBranchScope';
import { AttachmentService } from '@/shared/attachments';
import { SupabaseMaintenanceRepository } from '@/features/maintenance/repositories/supabaseMaintenanceRepository';
import { MaintenanceService } from '@/features/maintenance/services/maintenanceService';
import { isNonEmptyString, parseWithSchema, ValidationError } from '@/features/maintenance/utils/validation';
import { buildMaintenanceRecordCreateBodySchema, MaintenanceRecordCreateBody } from '@/features/maintenance/schemas';
import { MaintenanceRecordCreateInput } from '@/features/maintenance/types';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } },
      { status: 401 }
    );
  }

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  // Dealer/Branch Scope Platform Standard: this collection route was
  // previously completely unscoped (returned every dealer's records to
  // any authenticated user) - `session` now makes `list()` apply the
  // shared `applyScope()` inside the repository, same as every other
  // list path in this app.
  const { searchParams } = new URL(req.url);
  const filter = {
    dealerId: searchParams.get('dealerId') ?? undefined,
    branchId: searchParams.get('branchId') ?? undefined,
  };

  try {
    const data = await service.list(filter, session);
    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (error) {
    console.error('PM Record list API error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } },
      { status: 400 }
    );
  }

  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));

  // Zero-leakage: only a privileged role may set an arbitrary dealer_id from
  // the request body — everyone else is pinned to their own session dealer,
  // mirroring the same rule already enforced in src/app/api/records/route.ts.
  // dealer_id is resolved here, not via the schema below, because schema
  // validation can only check shape - not who is allowed to set what.
  const { dealerId } = resolveDealerScope(session, typeof body.dealer_id === 'string' ? body.dealer_id.trim() : undefined);
  if (!isNonEmptyString(dealerId)) {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'dealer_id is required' } },
      { status: 400 }
    );
  }

  let parsedBody: MaintenanceRecordCreateBody;
  try {
    parsedBody = parseWithSchema<MaintenanceRecordCreateBody>(buildMaintenanceRecordCreateBodySchema(locale), body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json(
        { ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } },
        { status: 400 }
      );
    }
    throw error;
  }

  // The vehicle's own branch_id (not a scope filter) must actually belong
  // to the resolved dealer - closes a spoofed cross-dealer branch_id from
  // a privileged role's request body.
  try {
    await assertBranchAccess(dealerId, parsedBody.branch_id ?? null);
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'branch_id does not belong to dealer_id' } },
      { status: 400 }
    );
  }

  // Server-side re-validation: the create form only ever offers intervals
  // returned by GET /api/pm-intervals?model=<vehicle's model> (resolved via
  // Product Family), but nothing previously stopped a client from POSTing
  // an arbitrary pm_interval_id outside that set - found in the
  // production-stabilization audit as a "trust the client" gap
  // inconsistent with how dealer_id is already re-validated above. A
  // vehicle with no model known yet (stockNote fallback path) has no
  // Product Family to validate against, so this only applies when a model
  // is present - matching listActivePmIntervals()'s own "no model = no
  // filtering" behavior.
  if (parsedBody.model) {
    const allowedIntervals = await listActivePmIntervals(parsedBody.model);
    const allowedIds = new Set(allowedIntervals.map((iv) => iv.id));
    if (!allowedIds.has(parsedBody.pm_interval_id)) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: translate(locale, 'validation.pmIntervalNotInProgram'),
          },
        },
        { status: 400 }
      );
    }
  }

  const input: MaintenanceRecordCreateInput = {
    dealer_id: dealerId,
    ...parsedBody,
  };

  const repository = new SupabaseMaintenanceRepository();
  const service = new MaintenanceService(repository);

  try {
    const record = await service.create(input, { username: session.username });

    // Photos were uploaded via AttachmentService against a temporary
    // client-generated entity ID before this record existed - re-tag them
    // with the record's real id now (mirrors src/app/api/records/route.ts's
    // identical pattern for MQR photos). A maintenance visit is a single,
    // already-complete event, so its attachments' retention clock starts
    // immediately (unlike MQR, which waits for the record to close).
    // Neither step may fail the create.
    try {
      const attachmentService = new AttachmentService();
      const attachmentIds = [record.meter_photo_attachment_id, record.nameplate_photo_attachment_id, record.report_photo_attachment_id].filter(
        (id): id is string => !!id
      );
      if (attachmentIds.length > 0) {
        await attachmentService.reassignEntity(attachmentIds, record.id);
        await Promise.all(attachmentIds.map((id) => attachmentService.markBusinessComplete(id)));
      }
    } catch (err) {
      console.error('attachment reassign/business-complete error (pm-record)', err);
    }

    return NextResponse.json({ ok: true, data: record }, { status: 201 });
  } catch (error) {
    console.error('PM Record create API error', error);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } },
      { status: 500 }
    );
  }
}
