import { getSupabase } from '../supabase';
import { AuthAuditEventType } from './auditService';

/**
 * IP-based rate limiting, distinct from Account Lock Protection
 * (`db.ts`'s `recordFailedLogin`/`checkLockStatus`, which is per-account).
 * This catches a different attack shape: many attempts spread across many
 * *different* usernames/emails from one IP, which per-account lockout
 * never sees since it only ever counts one account's own failures.
 *
 * Deliberately reuses `auth_audit_log` (already `ip_address`+`created_at`
 * indexed) as the counting store rather than adding an in-memory limiter
 * or a new dependency (Redis/Upstash) - this app runs on Vercel
 * serverless functions, so in-memory state isn't shared across
 * invocations/cold starts anyway; the database is the only store that
 * actually is. Matches the exact pattern `recentFailedLogins()` in
 * `db.ts` already established for the per-account case.
 */
export async function isRateLimited(
  ipAddress: string | null,
  eventTypes: AuthAuditEventType[],
  windowMinutes: number,
  maxAttempts: number
): Promise<boolean> {
  // Can't rate-limit a request we can't attribute to an IP - the
  // per-account lockout still applies regardless, so this never opens a
  // real gap, only fails to add a second layer for this one request.
  if (!ipAddress) return false;
  const supabase = getSupabase();
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('auth_audit_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_address', ipAddress)
    .in('event_type', eventTypes)
    .gte('created_at', since);
  if (error) throw error;
  return (count ?? 0) >= maxAttempts;
}
