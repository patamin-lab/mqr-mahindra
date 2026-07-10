import { getSupabase } from '../supabase';

/**
 * Email Health (Authentication Platform v3.0.1, Issue 3). Read-only
 * visibility into whether outbound auth email is actually working -
 * exactly the question the production incident (Forgot Password not
 * delivering) took a full manual trace to answer. Backed entirely by
 * environment variables (current configuration) and `auth_audit_log`'s
 * EMAIL_SEND_SUCCESS/EMAIL_SEND_FAILURE events (`email.ts`'s
 * `recordEmailOutcome`) - no new table, no new infrastructure.
 */
export type EmailHealthState = 'NotConfigured' | 'Degraded' | 'Healthy';

export interface EmailHealthStatus {
  provider: 'resend';
  /** Whether RESEND_API_KEY is set at all. */
  configured: boolean;
  /** The `from` address every auth email is actually sent with today. */
  sender: string;
  /** `true` when RESEND_FROM_EMAIL is unset, so `sender` falls back to
   *  Resend's own sandbox address - a heuristic, not a live domain-
   *  verification API call: the sandbox sender is documented by Resend
   *  to only deliver to the account owner's own verified address, which
   *  was the leading suspect in the production incident this patch
   *  fixes. */
  usingSandboxSender: boolean;
  lastSendAt: string | null;
  lastSendOk: boolean | null;
  lastFailureAt: string | null;
  lastFailureReason: string | null;
  status: EmailHealthState;
}

export async function getEmailHealth(): Promise<EmailHealthStatus> {
  const configured = !!process.env.RESEND_API_KEY;
  const sender = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  const usingSandboxSender = !process.env.RESEND_FROM_EMAIL;

  const supabase = getSupabase();
  const { data: lastSendRows, error: lastSendError } = await supabase
    .from('auth_audit_log')
    .select('event_type, created_at')
    .in('event_type', ['EMAIL_SEND_SUCCESS', 'EMAIL_SEND_FAILURE'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (lastSendError) throw lastSendError;
  const lastSend = lastSendRows?.[0] ?? null;

  const { data: lastFailureRows, error: lastFailureError } = await supabase
    .from('auth_audit_log')
    .select('metadata, created_at')
    .eq('event_type', 'EMAIL_SEND_FAILURE')
    .order('created_at', { ascending: false })
    .limit(1);
  if (lastFailureError) throw lastFailureError;
  const lastFailure = lastFailureRows?.[0] ?? null;

  let status: EmailHealthState = 'Healthy';
  if (!configured) {
    status = 'NotConfigured';
  } else if (usingSandboxSender || lastSend?.event_type === 'EMAIL_SEND_FAILURE') {
    status = 'Degraded';
  }

  return {
    provider: 'resend',
    configured,
    sender,
    usingSandboxSender,
    lastSendAt: lastSend?.created_at ?? null,
    lastSendOk: lastSend ? lastSend.event_type === 'EMAIL_SEND_SUCCESS' : null,
    lastFailureAt: lastFailure?.created_at ?? null,
    lastFailureReason: (lastFailure?.metadata as { errorMessage?: string } | null)?.errorMessage ?? null,
    status,
  };
}
