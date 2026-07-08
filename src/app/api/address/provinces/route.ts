import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { MasterDataService } from '@/shared/master-data';

/** Address Platform - backs the shared `AddressSelector`'s Province step.
 *  Served via API rather than bundled client-side since the underlying
 *  master data is a ~3.5MB JSON file (7,436 subdistrict rows) - loaded
 *  once per serverless instance on the server, never shipped to the
 *  browser. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  return NextResponse.json({ ok: true, provinces: MasterDataService.listProvinces() });
}
