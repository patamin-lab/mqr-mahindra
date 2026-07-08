import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';

/** Address Platform - backs the shared `AddressSelector`'s District step.
 *  Query param is `province_id` per the MASP Enterprise Development
 *  Standard's canonical Address Platform API naming (ADR-011). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const provinceId = new URL(req.url).searchParams.get('province_id');
  if (!provinceId) return NextResponse.json({ ok: true, districts: [] });

  return NextResponse.json({ ok: true, districts: await MasterDataService.listDistricts(provinceId) });
}
