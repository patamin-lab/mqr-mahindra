import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';

/** Active Product Family lookup for a business-facing dropdown (NTR's
 *  registration form) - mirrors /api/pm-intervals, not an admin route. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const productFamilies = await MasterDataService.getActiveProductFamilies();
  return NextResponse.json({ ok: true, productFamilies });
}
