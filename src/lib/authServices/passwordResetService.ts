import { randomBytes, createHash } from 'crypto';
import { getSupabase } from '../supabase';

/**
 * Password Reset (spec section 3). Token requirements from the spec,
 * verified line by line:
 * - cryptographically secure: `crypto.randomBytes(32)`, never `Math.random`.
 * - hashed in database: only `sha256(token)` is ever stored in
 *   `auth_tokens.token_hash` - the raw token exists only in the email
 *   link, never persisted anywhere.
 * - single use: enforced by `used_at` (checked in `validateResetToken`,
 *   set in `consumeResetToken`).
 * - expires after 30 minutes: `RESET_TOKEN_EXPIRY_MINUTES`.
 */
const RESET_TOKEN_EXPIRY_MINUTES = 30;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function generateResetToken(userId: string): Promise<string> {
  const supabase = getSupabase();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const { error } = await supabase.from('auth_tokens').insert({
    user_id: userId,
    purpose: 'password_reset',
    token_hash: hashToken(token),
    expires_at: expiresAt,
  });
  if (error) throw error;
  return token;
}

export interface TokenValidation {
  valid: boolean;
  userId?: string;
  reason?: 'not_found' | 'expired' | 'used';
}

export async function validateResetToken(token: string): Promise<TokenValidation> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('auth_tokens')
    .select('user_id, expires_at, used_at')
    .eq('token_hash', hashToken(token))
    .eq('purpose', 'password_reset')
    .maybeSingle();
  if (error) throw error;
  if (!data) return { valid: false, reason: 'not_found' };
  if (data.used_at) return { valid: false, reason: 'used' };
  if (new Date(data.expires_at).getTime() <= Date.now()) return { valid: false, reason: 'expired' };
  return { valid: true, userId: data.user_id };
}

export async function consumeResetToken(token: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('auth_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', hashToken(token))
    .eq('purpose', 'password_reset');
  if (error) throw error;
}
