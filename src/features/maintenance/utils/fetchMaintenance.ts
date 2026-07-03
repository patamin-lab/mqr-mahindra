import { headers } from 'next/headers';
import type { MaintenanceRecord } from '../types';

export type FetchMaintenanceResult =
  | { notFound: true }
  | { error: string }
  | { record: MaintenanceRecord };

/** Server-side fetch of a single Maintenance Record via the API route (not
 *  the repository/service directly) - keeps "UI never accesses Repository
 *  directly" true even for Server Components. Shared by the detail page
 *  and the edit page so the fetch/error-shape handling isn't duplicated.
 *  API route path (`/api/pm-records`) is unchanged - backward compatibility. */
export async function fetchMaintenance(id: string): Promise<FetchMaintenanceResult> {
  const cookieHeader = headers().get('cookie') ?? '';
  // VERCEL_URL is set automatically by Vercel for every deployment (no
  // manual config needed) - falling through to it before localhost avoids
  // this Server Component's own-origin fetch silently targeting
  // http://localhost:3000 (unreachable from inside a serverless function)
  // if NEXT_PUBLIC_APP_URL was never explicitly configured.
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const response = await fetch(
    `${baseUrl}/api/pm-records/${encodeURIComponent(id)}`,
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

  return { record: payload.data as MaintenanceRecord };
}
