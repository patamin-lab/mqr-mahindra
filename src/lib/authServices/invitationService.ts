import { randomBytes, createHash } from 'crypto';
import { getSupabase } from '../supabase';

/**
 * User Invitation (spec section 8) - same token shape as
 * `passwordResetService.ts` (they're structurally identical: hashed,
 * single-use, expiring), sharing the same `auth_tokens` table with
 * `purpose = 'invitation'` rather than a second near-duplicate table.
 * Only the expiry differs: 7 days, not 30 minutes.
 */
const INVITATION_EXPIRY_DAYS = 7;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function generateInvitationToken(userId: string, invitedBy: string): Promise<string> {
  const supabase = getSupabase();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('auth_tokens').insert({
    user_id: userId,
    purpose: 'invitation',
    token_hash: hashToken(token),
    expires_at: expiresAt,
    created_by: invitedBy,
  });
  if (error) throw error;
  return token;
}

export interface TokenValidation {
  valid: boolean;
  userId?: string;
  reason?: 'not_found' | 'expired' | 'used';
}

export async function validateInvitationToken(token: string): Promise<TokenValidation> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('auth_tokens')
    .select('user_id, expires_at, used_at')
    .eq('token_hash', hashToken(token))
    .eq('purpose', 'invitation')
    .maybeSingle();
  if (error) throw error;
  if (!data) return { valid: false, reason: 'not_found' };
  if (data.used_at) return { valid: false, reason: 'used' };
  if (new Date(data.expires_at).getTime() <= Date.now()) return { valid: false, reason: 'expired' };
  return { valid: true, userId: data.user_id };
}

export async function consumeInvitationToken(token: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', hashToken(token))
    .eq('purpose', 'invitation');
  if (error) throw error;
}

/** Never usable to actually log in (`active` stays `false` until the
 *  invite is accepted, and the login route already rejects
 *  `active === false` before ever comparing a password) - just satisfies
 *  `users.password_hash`'s NOT NULL constraint without a schema change. */
export function unusablePlaceholderPasswordHash(): string {
  return `invitation-pending:${randomBytes(32).toString('hex')}`;
}
