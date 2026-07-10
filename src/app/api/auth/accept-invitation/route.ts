import { NextRequest, NextResponse } from 'next/server';
import { activateUserAccount, getUserById } from '@/lib/db';
import { consumeInvitationToken, validateInvitationToken } from '@/lib/authServices/invitationService';
import { applyNewPassword, hashPassword, validateComplexity } from '@/lib/authServices/passwordService';
import { logAuthEvent } from '@/lib/authServices/auditService';
import { ensureCompletion } from '@/lib/authServices/reliability';

const TOKEN_ERROR_MESSAGES: Record<NonNullable<Awaited<ReturnType<typeof validateInvitationToken>>['reason']>, string> = {
  not_found: 'ลิงก์คำเชิญไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ',
  expired: 'ลิงก์คำเชิญนี้หมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบให้ส่งคำเชิญใหม่',
  used: 'ลิงก์คำเชิญนี้ถูกใช้ไปแล้ว',
};

/** User Invitation, last step of the flow (spec section 8): "User opens
 *  link -> Sets password -> Account activated." */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = String(body.token ?? '');
    const newPassword = String(body.newPassword ?? '');
    const confirmPassword = String(body.confirmPassword ?? '');

    if (!token) return NextResponse.json({ ok: false, error: 'ลิงก์ไม่ถูกต้อง' }, { status: 400 });
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ ok: false, error: 'รหัสผ่านและการยืนยันไม่ตรงกัน' }, { status: 400 });
    }
    const complexityError = validateComplexity(newPassword);
    if (complexityError) return NextResponse.json({ ok: false, error: complexityError }, { status: 400 });

    const validation = await validateInvitationToken(token);
    if (!validation.valid || !validation.userId) {
      const message = validation.reason ? TOKEN_ERROR_MESSAGES[validation.reason] : TOKEN_ERROR_MESSAGES.not_found;
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    const user = await getUserById(validation.userId);
    if (!user) return NextResponse.json({ ok: false, error: 'ไม่พบบัญชีผู้ใช้นี้' }, { status: 404 });

    const { hash, salt } = await hashPassword(newPassword);
    await applyNewPassword(validation.userId, hash, salt, { clearForcePasswordChange: true });
    await activateUserAccount(validation.userId);
    await consumeInvitationToken(token);

    await ensureCompletion(logAuthEvent('INVITATION_ACCEPTED', { username: user.username, userId: user.id }), {
      task: 'logAuthEvent:INVITATION_ACCEPTED',
      userId: user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('accept-invitation error', err);
    return NextResponse.json({ ok: false, error: 'เกิดข้อผิดพลาดในระบบ' }, { status: 500 });
  }
}
