import { NextRequest, NextResponse } from 'next/server';
import { unauthorizedError } from '@/lib/apiError';
import { getSupabase } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { updateBranch } from '@/lib/db';
import { canManageMasterData } from '@/lib/scope';
import { canAccessDealerBranch } from '@/lib/dealerBranchScope';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return unauthorizedError();
  if (!canManageMasterData(session.role)) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
  }
  try {
    // Dealer Admin: verify the branch belongs to their own dealer before allowing the edit.
    const supabase = getSupabase();
    const { data: existing } = await supabase.from('branches').select('dealer_id').eq('id', params.id).maybeSingle();
    if (!existing || !canAccessDealerBranch(session, existing.dealer_id, null)) {
      return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึงสาขานี้' }, { status: 403 });
    }
    const body = await req.json();
    const branch = await updateBranch(params.id, { code: body.code, name: body.name, active: body.active }, session);
    return NextResponse.json({ ok: true, branch });
  } catch (err: any) {
    console.error('update branch error', err);
    return NextResponse.json({ ok: false, error: err?.message ?? 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
