import { NextResponse } from 'next/server';

/**
 * Shared `{ ok: false, error: { code, message } }` API error response - the
 * structured-error convention. A separate, older plain-string `error` shape
 * (`{ ok: false, error: 'unauthorized' }`) still exists at a handful of
 * call sites this pass didn't reach; `fetchJson()` (`src/lib/fetchJson.ts`)
 * already treats both shapes as equivalent for every caller that goes
 * through it, so migrating a route from one shape to the other here is not
 * a breaking change for any `fetchJson()`-based caller.
 */
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export const unauthorizedError = () => apiError('UNAUTHORIZED', 'unauthorized', 401);

/** `{ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 }` - the generic
 *  403 shape used for a role-gate check with no more specific message.
 *  Routes with a distinct, action-specific 403 message (e.g. "no
 *  permission to reset this user's password") are unaffected - only the
 *  identical generic string is a duplication worth extracting. */
export const forbiddenError = () => NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
