/**
 * Authentication Platform v3.0.1 (reliability patch). Vercel serverless
 * functions can freeze a request's execution environment the instant the
 * HTTP response is sent — any promise still pending at that point has no
 * guarantee of ever resuming, let alone completing. This is exactly what
 * caused a real production incident: a PASSWORD_RESET_REQUEST audit row
 * that never got written despite the awaited reset-token insert
 * immediately before it succeeding, because both the email send and the
 * audit log write were fire-and-forget (`.catch(() => {})`, never
 * `await`ed) after the last awaited operation in the route.
 *
 * Every background call in the Authentication Platform that must
 * actually complete (email sends, audit log writes, session revocations)
 * is now `await`ed through this helper instead. It never throws — a
 * failure here must never change what the caller returns to the client
 * (e.g. Forgot Password's generic message is unconditional by design),
 * so a rejection is captured via structured logging instead of
 * re-thrown, and `null` is returned so the caller can still tell
 * something failed if it needs to.
 */
export interface BackgroundTaskContext {
  task: string;
  [key: string]: unknown;
}

export async function ensureCompletion<T>(
  promise: Promise<T>,
  context: BackgroundTaskContext
): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    console.error('[auth] background task failed', {
      ...context,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
