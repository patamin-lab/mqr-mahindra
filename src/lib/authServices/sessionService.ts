import { NextRequest } from 'next/server';
import { getSupabase } from '../supabase';
import { parseUserAgent } from './userAgentParser';
import { logAuthEvent } from './auditService';

/**
 * Session Platform Foundation (Authentication Platform v3.0). Before this,
 * `mqr_session` was a fully stateless JWT — no server-side record, so a
 * session could never be listed, revoked, or tied to a device (see
 * `docs/adr/ADR-014-Authentication-Platform-v3.md`). Every session now
 * gets a `user_sessions` row; the JWT carries only the opaque
 * `sessionId` used to look it up. Revoking a row takes effect on the
 * requester's very next request (checked in `middleware.ts`), not merely
 * on next login.
 */
export interface SessionRecord {
  id: string;
  user_id: string;
  session_id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  user_agent: string | null;
  approx_location: string | null;
  last_activity: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

/** First hop of a comma-separated `x-forwarded-for` — the real client IP
 *  behind Vercel's edge network. */
export function clientIpFrom(req: NextRequest | Request): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip');
}

/** Vercel populates these geo headers automatically at the edge — no
 *  geo-IP dependency/external call needed. Absent off-Vercel (local dev),
 *  which degrades gracefully to `null`, matching the spec's "if available". */
export function approxLocationFrom(req: NextRequest | Request): string | null {
  const city = req.headers.get('x-vercel-ip-city');
  const country = req.headers.get('x-vercel-ip-country');
  const decodedCity = city ? decodeURIComponent(city) : null;
  if (decodedCity && country) return `${decodedCity}, ${country}`;
  return country ?? decodedCity ?? null;
}

export async function createSession(
  userId: string,
  req: NextRequest | Request,
  expiresInMinutes: number
): Promise<{ sessionId: string; expiresAt: string }> {
  const supabase = getSupabase();
  const sessionId = crypto.randomUUID();
  const userAgent = req.headers.get('user-agent');
  const { browser, os, deviceName } = parseUserAgent(userAgent);
  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString();

  const ipAddress = clientIpFrom(req);
  const { error } = await supabase.from('user_sessions').insert({
    user_id: userId,
    session_id: sessionId,
    device_name: deviceName,
    browser,
    os,
    ip_address: ipAddress,
    user_agent: userAgent,
    approx_location: approxLocationFrom(req),
    expires_at: expiresAt,
  });
  if (error) throw error;
  logAuthEvent('SESSION_CREATED', { userId, ipAddress, userAgent, metadata: { sessionId } }).catch(() => {});
  return { sessionId, expiresAt };
}

export async function touchLastActivity(sessionId: string): Promise<void> {
  const supabase = getSupabase();
  await supabase
    .from('user_sessions')
    .update({ last_activity: new Date().toISOString() })
    .eq('session_id', sessionId)
    .is('revoked_at', null);
}

export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq('session_id', sessionId)
    .is('revoked_at', null)
    .select('user_id')
    .maybeSingle();
  if (error) throw error;
  if (data) logAuthEvent('SESSION_REVOKED', { userId: data.user_id, metadata: { sessionId, reason } }).catch(() => {});
}

/** Used by "Logout all other devices" (a checkbox on Change Password) and
 *  the Active Sessions page's "Logout all other sessions" button. */
export async function revokeAllOtherSessions(userId: string, exceptSessionId: string, reason: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq('user_id', userId)
    .neq('session_id', exceptSessionId)
    .is('revoked_at', null);
  if (error) throw error;
  logAuthEvent('SESSION_REVOKED_ALL', { userId, metadata: { reason, exceptSessionId } }).catch(() => {});
}

/** Used by the admin's "force logout all sessions" action. */
export async function revokeAllSessions(userId: string, reason: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('user_sessions')
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq('user_id', userId)
    .is('revoked_at', null);
  if (error) throw error;
  logAuthEvent('SESSION_REVOKED_ALL', { userId, metadata: { reason } }).catch(() => {});
}

export async function listSessionsForUser(userId: string): Promise<SessionRecord[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('last_activity', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SessionRecord[];
}

/** Single-session lookup used to authorize "logout selected session"
 *  (must belong to the requesting user — never trust a client-supplied id
 *  without checking ownership first). */
export async function getSessionByOwnerAndId(userId: string, sessionId: string): Promise<SessionRecord | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('user_sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data as SessionRecord | null;
}
