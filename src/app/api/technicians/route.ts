import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSession } from '@/lib/auth';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { MasterDataService } from '@/shared/master-data';

/** Active-technician lookup for the report form's cascading dropdown (not an admin route). */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorizedError();

  const { searchParams } = new URL(req.url);
  const { dealerId } = resolveDealerScope(session, searchParams.get('dealerId'));
  const branch = searchParams.get('branch');

  const technicians = await MasterDataService.getTechniciansForDealer(dealerId, branch);
  return NextResponse.json({ ok: true, technicians });
}
