import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { getSupabase } from '../supabase';
import { sha256Hex } from '../auth';

/**
 * Secure password hashing + history/complexity policy (Authentication
 * Platform v3.0, spec section 10). Moves password verification off plain
 * unsalted SHA-256 ("matches the legacy Apps Script hashes") onto salted
 * scrypt (Node's built-in `crypto` - no new dependency), while staying
 * backward compatible: `users.password_algo`/`password_salt` already
 * existed in the schema (a previously-scaffolded, never-wired-up
 * migration), so a legacy row verifies against its sha256 hash exactly as
 * before and is opportunistically upgraded to scrypt the moment its owner
 * next logs in successfully or changes their password - never a forced,
 * disruptive bulk migration.
 */
const scryptAsync = promisify(scrypt) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

async function scryptHex(password: string, saltHex: string): Promise<string> {
  const derived = await scryptAsync(password, saltHex, 64);
  return derived.toString('hex');
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptHex(password, salt);
  return { hash, salt };
}

async function verifyScrypt(password: string, hash: string, salt: string): Promise<boolean> {
  const candidate = Buffer.from(await scryptHex(password, salt), 'hex');
  const stored = Buffer.from(hash, 'hex');
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

export interface StoredPassword {
  password_hash: string;
  password_salt: string | null;
  password_algo: string;
}

export async function verifyPassword(password: string, stored: StoredPassword): Promise<boolean> {
  if (stored.password_algo === 'scrypt' && stored.password_salt) {
    return verifyScrypt(password, stored.password_hash, stored.password_salt);
  }
  return (await sha256Hex(password)) === stored.password_hash;
}

/** Min length 8, at least one letter and one number - a conservative,
 *  broadly-applicable default. Returns the Thai error message, or `null`
 *  if the password passes. */
export function validateComplexity(password: string): string | null {
  if (password.length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  if (!/[A-Za-z]/.test(password)) return 'รหัสผ่านต้องมีตัวอักษรอย่างน้อย 1 ตัว';
  if (!/[0-9]/.test(password)) return 'รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว';
  return null;
}

/** `password_history` stores `${saltHex}:${hashHex}` in one column - this
 *  table is new (nothing else depends on its shape yet), so a
 *  self-contained format was simpler than adding a second salt column. */
function encodeHistoryEntry(hash: string, salt: string): string {
  return `${salt}:${hash}`;
}

/** Last 5, per spec section 10. */
export async function isPasswordReused(userId: string, newPassword: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('password_history')
    .select('password_hash')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(5);
  if (error) throw error;
  for (const row of data ?? []) {
    const [salt, hash] = String(row.password_hash).split(':');
    if (salt && hash && (await verifyScrypt(newPassword, hash, salt))) return true;
  }
  return false;
}

export async function recordPasswordHistory(userId: string, hash: string, salt: string): Promise<void> {
  const supabase = getSupabase();
  await supabase.from('password_history').insert({ user_id: userId, password_hash: encodeHistoryEntry(hash, salt) });
  const { data } = await supabase
    .from('password_history')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  const toPrune = (data ?? []).slice(5).map((r: { id: string }) => r.id);
  if (toPrune.length > 0) {
    await supabase.from('password_history').delete().in('id', toPrune);
  }
}

/** Writes the new hash, upgrades `password_algo` to `scrypt`, stamps
 *  `password_changed_at`, and (the caller decides when) clears
 *  `force_password_change`. Does not touch sessions - the caller wires
 *  that up via `sessionService` (re-signing the current session, and
 *  optionally revoking others). */
export async function applyNewPassword(
  userId: string,
  hash: string,
  salt: string,
  opts: { clearForcePasswordChange: boolean }
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('users')
    .update({
      password_hash: hash,
      password_salt: salt,
      password_algo: 'scrypt',
      password_changed_at: new Date().toISOString(),
      ...(opts.clearForcePasswordChange ? { force_password_change: false } : {}),
    })
    .eq('id', userId);
  if (error) throw error;
}
