import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createVehicleManual, getVehicleBySerial } from '@/lib/db';
import { resolveDealerScope, assertBranchAccess } from '@/lib/dealerBranchScope';
import { isNonEmptyString, parseWithSchema, ValidationError } from '@/lib/validation';
import { buildTractorCreateBodySchema, TractorCreateBody } from '@/features/ntr/schemas';
import { getLocaleFromCookieHeader } from '@/lib/i18n/server';

/**
 * NTR's "Create Tractor" step - only reached when Tractor Search found no
 * existing `vehicles` row. Never invoked to "fix" an existing tractor;
 * `serial` is unique at the database level so a genuine race (a Tractor
 * Sheet sync or a concurrent registration) surfaces as a real error rather
 * than a silent duplicate.
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON body' } }, { status: 400 });
  }

  const locale = getLocaleFromCookieHeader(req.headers.get('cookie'));

  // Zero-leakage: only a privileged role may set an arbitrary dealer_id -
  // everyone else is pinned to their own session dealer, same rule as
  // every other create route in this app.
  const { dealerId } = resolveDealerScope(session, typeof body.dealer_id === 'string' ? body.dealer_id.trim() : undefined);
  if (!isNonEmptyString(dealerId)) {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'dealer_id is required' } }, { status: 400 });
  }

  let parsed: TractorCreateBody;
  try {
    parsed = parseWithSchema<TractorCreateBody>(buildTractorCreateBodySchema(locale), body);
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: error.message } }, { status: 400 });
    }
    throw error;
  }

  try {
    await assertBranchAccess(dealerId, parsed.branch_id ?? null);
  } catch {
    return NextResponse.json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'branch_id does not belong to dealer_id' } }, { status: 400 });
  }

  try {
    const existing = await getVehicleBySerial(parsed.serial, null);
    if (existing) {
      return NextResponse.json(
        { ok: false, error: { code: 'CONFLICT', message: `Tractor serial "${parsed.serial}" already exists` } },
        { status: 409 }
      );
    }

    const vehicle = await createVehicleManual({
      serial: parsed.serial,
      model: parsed.model,
      engineNumber: parsed.engine_number,
      dealerId,
      branchId: parsed.branch_id,
      deliveryDate: parsed.delivery_date,
    });
    return NextResponse.json({ ok: true, data: vehicle }, { status: 201 });
  } catch (error) {
    console.error('NTR tractor create error', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } }, { status: 500 });
  }
}
