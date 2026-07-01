import { headers } from 'next/headers';
import type { PmRecord } from './types';

export type FetchPmRecordResult =
  | { notFound: true }
  | { error: string }
  | { record: PmRecord };

/** Server-side fetch of a single PM Record via the API route (not the
 *  repository/service directly) - keeps "UI never accesses Repository
 *  directly" true even for Server Components. Shared by the detail page
 *  and the edit page so the fetch/error-shape handling isn't duplicated. */
export async function fetchPmRecord(id: string): Promise<FetchPmRecordResult> {
  const cookieHeader = headers().get('cookie') ?? '';
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/pm-records/${encodeURIComponent(id)}`,
    {
      method: 'GET',
      headers: {
        cookie: cookieHeader,
      },
      cache: 'no-store',
    }
  );

  if (response.status === 404) {
    return { notFound: true };
  }

  const payload = await response.json();
  if (!response.ok) {
    const message =
      (typeof payload?.error === 'string' ? payload.error : payload?.error?.message) || 'Unable to load record';
    return { error: message };
  }

  return { record: payload.data as PmRecord };
}
