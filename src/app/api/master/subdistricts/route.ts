import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';

/** Address Platform - backs the shared `AddressSelector`'s Sub-District
 *  step, which also carries each subdistrict's valid postal code(s) so
 *  the selector can auto-fill Postal Code once a unique match exists.
 *  Query param is `district_id` per the MASP Enterprise Development
 *  Standard's canonical Address Platform API naming (ADR-011). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const districtId = new URL(req.url).searchParams.get('district_id');
  if (!districtId) return NextResponse.json({ ok: true, subdistricts: [] });

  return NextResponse.json({ ok: true, subdistricts: await MasterDataService.listSubdistricts(districtId) });
}
