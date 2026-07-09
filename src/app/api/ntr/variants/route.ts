import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createNtrService } from '@/features/ntr/factory';

/**
 * Sub Model dropdown options for the NTR registration form (NTR Form
 * Update, 2026-07) - distinct `variant` values already recorded for the
 * given Product Family. See `NtrRepository.listDistinctVariants()`'s doc
 * comment for why this reuses existing data rather than a new master-data
 * table.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'unauthorized' } }, { status: 401 });
  }

  const productFamilyId = new URL(req.url).searchParams.get('productFamilyId');
  if (!productFamilyId) return NextResponse.json({ ok: true, variants: [] });

  try {
    const variants = await createNtrService().listDistinctVariants(productFamilyId);
    return NextResponse.json({ ok: true, variants });
  } catch (error) {
    console.error('NTR variants lookup error', error);
    return NextResponse.json({ ok: false, error: { code: 'INTERNAL_ERROR', message: 'internal error' } }, { status: 500 });
  }
}
