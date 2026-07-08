import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';

/** Address Platform - backs the shared `AddressSelector`'s District step. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const provinceId = new URL(req.url).searchParams.get('provinceId');
  if (!provinceId) return NextResponse.json({ ok: true, districts: [] });

  return NextResponse.json({ ok: true, districts: MasterDataService.listDistricts(provinceId) });
}
