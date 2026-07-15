import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { canDelete } from '@/lib/scope';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';
import { parseWithSchema, ValidationError } from '@/lib/validation';
import { buildNtrRecordUpdateBodySchema, NtrRecordUpdateBody } from '@/features/ntr/schemas';
import { NtrRecord } from '@/features/ntr/types';
import { createNtrService } from '@/features/ntr/factory';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';
import { translate } from '@/lib/i18n/translate';
import type { SessionUser } from '@/lib/types';
import { unauthorizedError } from '@/lib/apiError';

/** Dealer/Branch Scope Platform Standard, two-layer defense in depth
 *  (matching this app's RLS + `applyScope()` convention elsewhere):
 *  `service.getById(id, session)` already applies dealer/branch scope
 *  inside the repository, but every route also independently re-checks
 *  via the shared `canAccessDealerBranch()` before acting - never trusts
 *  a single layer alone. */
function isOutOfScope(session: SessionUser, record: NtrRecord): boolean {
  return !canAccessDealerBranch(session, record.dealer_id, record.branch_id);
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));

  try {
    const record = await createNtrService().getById(params.id, session);
    if (!record) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'NTR record not found' } }, { status: 404 });
    }
    if (isOutOfScope(session, record)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: translate(locale, 'validation.unauthorizedRecordAccess') } },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: true, data: record }, { status: 200 });
  } catch (error) {
    console.error('NTR record detail API error', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }

  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } }, { status: 400 });
  }

  let input: NtrRecordUpdateBody;
  try {
    input = parseWithSchema<NtrRecordUpdateBody>(buildNtrRecordUpdateBodySchema(locale), body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 });
    }
    throw error;
  }

  const service = createNtrService();

  try {
    const existing = await service.getById(params.id, session);
    if (!existing) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'NTR record not found' } }, { status: 404 });
    }
    if (isOutOfScope(session, existing)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: translate(locale, 'validation.unauthorizedRecordAccess') } },
        { status: 403 }
      );
    }

    const record = await service.update(params.id, input, { username: session.username, role: session.role });
    return NextResponse.json({ ok: true, data: record }, { status: 200 });
  } catch (error) {
    console.error('NTR record update API error', error);
    const message = error instanceof Error ? error.message : 'internal error';
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) {
    return unauthorizedError();
  }
  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));
  // Same role gate as MQR's/PM's delete routes (`canDelete()` in scope.ts) -
  // reused, not reinvented, per the "no duplicated implementations" mandate.
  if (!canDelete(session.role)) {
    return NextResponse.json(
      { ok: false, error: { code: 'FORBIDDEN', message: translate(locale, 'validation.unauthorizedDelete') } },
      { status: 403 }
    );
  }

  let reason: string | null = null;
  try {
    const body = await req.json();
    if (typeof body?.reason === 'string') reason = body.reason;
  } catch {
    // No JSON body sent - fine, the delete button doesn't send one.
  }

  const service = createNtrService();

  try {
    const existing = await service.getById(params.id, session);
    if (!existing) {
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'NTR record not found' } }, { status: 404 });
    }
    if (isOutOfScope(session, existing)) {
      return NextResponse.json(
        { ok: false, error: { code: 'FORBIDDEN', message: translate(locale, 'validation.unauthorizedRecordAccess') } },
        { status: 403 }
      );
    }

    await service.delete(params.id, { username: session.username, role: session.role }, reason);
    return NextResponse.json({ ok: true, data: null }, { status: 200 });
  } catch (error) {
    console.error('NTR record delete API error', error);
    const message = error instanceof Error ? error.message : 'internal error';
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message } }, { status: 500 });
  }
}
