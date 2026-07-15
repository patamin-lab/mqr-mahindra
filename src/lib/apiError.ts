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
