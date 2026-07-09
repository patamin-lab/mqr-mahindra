import { getSupabase } from '../supabase';

/** Authentication Platform v3.0, spec section 11 - the exact 13 event
 *  types the spec names. Kept in a dedicated `auth_audit_log` table
 *  rather than extending `record_audit_log`/`AuditEventType`: that table
 *  is business-record-scoped (`module`+`record_id` tied to an actual
 *  mqr/pm/ntr row) and auth events - a login attempt, a session, an
 *  invitation - aren't record events, so forcing them through a type
 *  used everywhere for something it doesn't fit would widen it for no
 *  real gain. */
export type AuthAuditEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_UNLOCKED'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_SUCCESS'
  | 'PASSWORD_CHANGED'
  | 'SESSION_CREATED'
  | 'SESSION_REVOKED'
  | 'SESSION_REVOKED_ALL'
  | 'USER_INVITED'
  | 'INVITATION_ACCEPTED'
  | 'FORCE_PASSWORD_CHANGE_COMPLETED';

export interface AuthAuditContext {
  username?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

/** Never throws - an audit-log write failure must never break the
 *  authentication action it's describing (same "never blocks the
 *  caller" contract as `lib/email.ts`'s notification sends). */
export async function logAuthEvent(eventType: AuthAuditEventType, ctx: AuthAuditContext = {}): Promise<void> {
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('auth_audit_log').insert({
      event_type: eventType,
      username: ctx.username ?? null,
      user_id: ctx.userId ?? null,
      ip_address: ctx.ipAddress ?? null,
      user_agent: ctx.userAgent ?? null,
      metadata: ctx.metadata ?? {},
    });
    if (error) console.error('auth audit log error', error);
  } catch (err) {
    console.error('auth audit log error', err);
  }
}
