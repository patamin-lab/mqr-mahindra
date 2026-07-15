import { NextResponse } from 'next/server';

/**
 * Shared `{ ok: false, error: { code, message } }` API error response -
 * the structured-error convention used by pm-records/ntr-records/ntr/*
 * routes (as opposed to the older `admin/*` routes' plain-string `error`
 * shape, which this does not attempt to unify - a separate, larger
 * migration, not a mechanical extraction).
 */
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export const unauthorizedError = () => apiError('UNAUTHORIZED', 'unauthorized', 401);
