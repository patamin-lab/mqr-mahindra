import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { resolveDealerScope } from '@/lib/dealerBranchScope';
import { MasterDataService } from '@/shared/master-data';

/** Active-branch lookup for the Dealer/Branch Scope Platform Standard's
 *  cascading dropdown (`useDealerBranchScope`) - not an admin route. */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requested = searchParams.get('dealerId');
  const { dealerId } = resolveDealerScope(session, requested);

  const branches = await MasterDataService.getBranchesForDealer(dealerId);
  return NextResponse.json({ ok: true, branches });
}
