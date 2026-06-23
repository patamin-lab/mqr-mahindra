import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Server-only Supabase client. Uses the anon key, never exposed to the
 * browser (no NEXT_PUBLIC_ prefix on the env vars). All dealer/role scoping
 * is enforced in application code (see lib/db.ts), mirroring the original
 * Apps Script backend's "zero leakage" model.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY env vars are not set');
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export const STORAGE_BUCKET = 'mqr-files';
