From 121e4f09c5be3fbae919b5b7cd8040bcee17ef9f Mon Sep 17 00:00:00 2001
From: patamin-lab <patamin@gmail.com>
Date: Wed, 24 Jun 2026 03:38:22 +0000
Subject: [PATCH] Phase 8: backend security hardening
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit

- Upload route: enforce a server-side file-type allowlist (images + the
  one video field); content-type is now taken from a trusted map instead
  of the client-supplied MIME type, closing a stored-file-type /
  arbitrary-upload gap on the public storage bucket.
- Login: add a per-username lockout (5 failed attempts / 10 min, DB-backed
  via login_log) to slow down credential-stuffing/brute-force attempts.
- Password hashing: introduce salted scrypt for all newly-created and
  reset passwords, with a transparent, on-login upgrade path for accounts
  still on the legacy unsalted-SHA256 hash inherited from the old Apps
  Script system. Added password_algo/password_salt columns via a Supabase
  migration. Password comparisons now use a timing-safe equality check.
- Enforce an 8-character minimum password length consistently at both
  user-creation and password-reset time (creation previously had no
  length check at all).
- findUserByUsername: escape ILIKE wildcard characters so a username
  containing % or _ can't pattern-match a different account.
- next.config.mjs: add baseline security response headers (X-Frame-Options,
  X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy).

Audited (Phase 8a-8e): every API route's session/RBAC/IDOR handling,
upload path safety, env var / secret exposure, and CORS — all clean.
Supabase RLS policies remain overly permissive (USING/WITH CHECK true) on
records/login_log/job_seq, and next_job_seq() is a SECURITY DEFINER
function callable by anon/authenticated -- this is necessary today because
the app authenticates with the static anon key and enforces RBAC entirely
in the Next.js layer, not via Postgres identity claims. Tightening this
properly requires minting per-request Supabase JWTs (new SUPABASE_JWT_SECRET)
and is left as a follow-up, flagged separately to the user.
---
 .gitignore                                    |  1 +
 next.config.mjs                               | 17 +++++++
 .../admin/users/[id]/reset-password/route.ts  |  9 ++--
 src/app/api/admin/users/route.ts              |  9 +++-
 src/app/api/auth/login/route.ts               | 32 ++++++++++--
 src/app/api/upload/route.ts                   | 29 ++++++++++-
 src/lib/auth.ts                               | 43 ++++++++++++++++
 src/lib/db.ts                                 | 49 +++++++++++++++++--
 8 files changed, 174 insertions(+), 15 deletions(-)

diff --git a/.gitignore b/.gitignore
index 3cecc38..7232548 100755
--- a/.gitignore
+++ b/.gitignore
@@ -1,3 +1,4 @@
 node_modules
 .next
 .env.local
+*.tsbuildinfo
diff --git a/next.config.mjs b/next.config.mjs
index 11257d2..6619539 100755
--- a/next.config.mjs
+++ b/next.config.mjs
@@ -1,5 +1,22 @@
 /** @type {import('next').NextConfig} */
 const nextConfig = {
   eslint: { ignoreDuringBuilds: true },
+  async headers() {
+    return [
+      {
+        source: '/:path*',
+        headers: [
+          // Internal tool — never meant to be framed by another site.
+          { key: 'X-Frame-Options', value: 'DENY' },
+          { key: 'X-Content-Type-Options', value: 'nosniff' },
+          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
+          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
+          // Report form's location picker uses browser geolocation; nothing
+          // else in the app touches camera/microphone.
+          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
+        ],
+      },
+    ];
+  },
 };
 export default nextConfig;
diff --git a/src/app/api/admin/users/[id]/reset-password/route.ts b/src/app/api/admin/users/[id]/reset-password/route.ts
index db13094..94bd50e 100644
--- a/src/app/api/admin/users/[id]/reset-password/route.ts
+++ b/src/app/api/admin/users/[id]/reset-password/route.ts
@@ -1,5 +1,5 @@
 import { NextRequest, NextResponse } from 'next/server';
-import { getSession, sha256Hex } from '@/lib/auth';
+import { getSession, hashPasswordStrong } from '@/lib/auth';
 import { getUserById, resetUserPassword } from '@/lib/db';
 import { canManageUsers, canManageRoleTarget, seesAllDealers } from '@/lib/scope';
 
@@ -20,10 +20,11 @@ export async function POST(req: NextRequest, { params }: { params: { id: string
     }
     const body = await req.json();
     const newPassword = String(body.newPassword ?? '');
-    if (newPassword.length < 6) {
-      return NextResponse.json({ ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' }, { status: 400 });
+    if (newPassword.length < 8) {
+      return NextResponse.json({ ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
     }
-    await resetUserPassword(params.id, await sha256Hex(newPassword), session);
+    const { hash: passwordHash, salt: passwordSalt } = hashPasswordStrong(newPassword);
+    await resetUserPassword(params.id, passwordHash, passwordSalt, session);
     return NextResponse.json({ ok: true });
   } catch (err: any) {
     console.error('reset password error', err);
diff --git a/src/app/api/admin/users/route.ts b/src/app/api/admin/users/route.ts
index 541bb44..235b7d1 100644
--- a/src/app/api/admin/users/route.ts
+++ b/src/app/api/admin/users/route.ts
@@ -1,5 +1,5 @@
 import { NextRequest, NextResponse } from 'next/server';
-import { getSession, sha256Hex } from '@/lib/auth';
+import { getSession, hashPasswordStrong } from '@/lib/auth';
 import { listAllUsersAdmin, createUserAdmin, findUserByUsername } from '@/lib/db';
 import { seesAllDealers, canManageUsers, assignableRoles } from '@/lib/scope';
 import { Role } from '@/lib/types';
@@ -32,6 +32,9 @@ export async function POST(req: NextRequest) {
     if (!username || !fullName || !password || !role) {
       return NextResponse.json({ ok: false, error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
     }
+    if (password.length < 8) {
+      return NextResponse.json({ ok: false, error: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร' }, { status: 400 });
+    }
     if (!assignableRoles(session.role).includes(role)) {
       return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์กำหนดบทบาทนี้' }, { status: 403 });
     }
@@ -43,10 +46,12 @@ export async function POST(req: NextRequest) {
     // Dealer Admin may only create users inside their own dealer.
     const dealerId = seesAllDealers(session.role) ? (body.dealer_id ?? null) : session.dealerId;
 
+    const { hash: passwordHash, salt: passwordSalt } = hashPasswordStrong(password);
     const user = await createUserAdmin(
       {
         username,
-        passwordHash: await sha256Hex(password),
+        passwordHash,
+        passwordSalt,
         fullName,
         email: body.email ?? null,
         mobile: body.mobile ?? null,
diff --git a/src/app/api/auth/login/route.ts b/src/app/api/auth/login/route.ts
index b1425cc..f9a25b6 100644
--- a/src/app/api/auth/login/route.ts
+++ b/src/app/api/auth/login/route.ts
@@ -1,8 +1,14 @@
 import { NextRequest, NextResponse } from 'next/server';
-import { findUserByUsername, insertLoginLog } from '@/lib/db';
-import { sha256Hex, signSession, SESSION_COOKIE, SESSION_MINUTES } from '@/lib/auth';
+import { findUserByUsername, insertLoginLog, recentFailedLogins, upgradePasswordHash } from '@/lib/db';
+import { verifyPassword, signSession, SESSION_COOKIE, SESSION_MINUTES } from '@/lib/auth';
 import { SessionUser } from '@/lib/types';
 
+// Lockout window: after this many failed attempts for one username within
+// the window below, further attempts are rejected without even checking the
+// password, until the window rolls off.
+const LOCKOUT_THRESHOLD = 5;
+const LOCKOUT_WINDOW_MINUTES = 10;
+
 export async function POST(req: NextRequest) {
   let username = '';
   try {
@@ -11,14 +17,32 @@ export async function POST(req: NextRequest) {
     const password = String(body.password ?? '');
     const device = req.headers.get('user-agent') ?? '';
 
+    if (username) {
+      const failures = await recentFailedLogins(username, LOCKOUT_WINDOW_MINUTES);
+      if (failures >= LOCKOUT_THRESHOLD) {
+        await insertLoginLog({ username, role: '', action: 'เข้าสู่ระบบ', device, result: 'fail' });
+        return NextResponse.json(
+          { ok: false, error: 'มีการเข้าสู่ระบบผิดพลาดหลายครั้ง กรุณารอสักครู่แล้วลองใหม่' },
+          { status: 429 }
+        );
+      }
+    }
+
     const user = await findUserByUsername(username);
-    const hash = await sha256Hex(password);
+    const verified = user ? await verifyPassword(password, user) : { ok: false as const };
 
-    if (!user || user.password_hash !== hash || user.active === false) {
+    if (!user || !verified.ok || user.active === false) {
       await insertLoginLog({ username, role: user?.role ?? '', action: 'เข้าสู่ระบบ', device, result: 'fail' });
       return NextResponse.json({ ok: false, error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' }, { status: 401 });
     }
 
+    // Transparent upgrade: a legacy unsalted-SHA256 hash just verified
+    // successfully — replace it with a salted-scrypt hash so it doesn't stay
+    // around any longer than necessary.
+    if (verified.upgrade) {
+      await upgradePasswordHash(user.id, verified.upgrade.hash, verified.upgrade.salt);
+    }
+
     const sessionUser: SessionUser = {
       username: user.username,
       fullName: user.full_name,
diff --git a/src/app/api/upload/route.ts b/src/app/api/upload/route.ts
index bdcbe50..7906da6 100644
--- a/src/app/api/upload/route.ts
+++ b/src/app/api/upload/route.ts
@@ -6,6 +6,25 @@ import convertHeic from 'heic-convert';
 const HEIC_EXTENSIONS = new Set(['heic', 'heif']);
 const HEIC_MIME_TYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);
 
+// The only file kinds the app ever asks for (report-form photo fields use
+// image/*+heic/heif, the one video field uses video/*). Anything outside
+// this allowlist — executables, HTML, SVG (a common stored-XSS vector),
+// archives, etc. — is rejected before it ever reaches storage. The stored
+// content-type is taken from this map, never trusted from the client.
+const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
+  jpg: 'image/jpeg',
+  jpeg: 'image/jpeg',
+  png: 'image/png',
+  webp: 'image/webp',
+  gif: 'image/gif',
+  heic: 'image/heic',
+  heif: 'image/heif',
+  mp4: 'video/mp4',
+  mov: 'video/quicktime',
+  m4v: 'video/x-m4v',
+  webm: 'video/webm',
+};
+
 export async function POST(req: NextRequest) {
   const session = await getSession();
   if (!session) {
@@ -22,8 +41,14 @@ export async function POST(req: NextRequest) {
     return NextResponse.json({ ok: false, error: 'ไฟล์มีขนาดใหญ่เกินไป (จำกัด 25MB)' }, { status: 400 });
   }
 
-  let ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
-  let contentType = file.type || 'application/octet-stream';
+  let ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
+  if (!Object.prototype.hasOwnProperty.call(ALLOWED_UPLOAD_TYPES, ext)) {
+    return NextResponse.json(
+      { ok: false, error: 'ชนิดไฟล์นี้ไม่ได้รับอนุญาต (รองรับเฉพาะรูปภาพและวิดีโอ)' },
+      { status: 400 }
+    );
+  }
+  let contentType = ALLOWED_UPLOAD_TYPES[ext];
   let buf = Buffer.from(await file.arrayBuffer());
 
   // iPhones commonly upload HEIC/HEIF photos, which most browsers and PDF
diff --git a/src/lib/auth.ts b/src/lib/auth.ts
index c81a59e..a072780 100644
--- a/src/lib/auth.ts
+++ b/src/lib/auth.ts
@@ -1,5 +1,6 @@
 import { SignJWT, jwtVerify } from 'jose';
 import { cookies } from 'next/headers';
+import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';
 import { SessionUser } from './types';
 
 export const SESSION_COOKIE = 'mqr_session';
@@ -20,6 +21,48 @@ export async function sha256Hex(text: string): Promise<string> {
     .join('');
 }
 
+const SCRYPT_KEYLEN = 64;
+
+/** Strong, salted password hash for newly-created/reset passwords. */
+export function hashPasswordStrong(password: string): { hash: string; salt: string } {
+  const salt = randomBytes(16).toString('hex');
+  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
+  return { hash, salt };
+}
+
+function timingSafeEqualHex(a: string, b: string): boolean {
+  try {
+    const bufA = Buffer.from(a, 'hex');
+    const bufB = Buffer.from(b, 'hex');
+    if (bufA.length === 0 || bufA.length !== bufB.length) return false;
+    return timingSafeEqual(bufA, bufB);
+  } catch {
+    return false;
+  }
+}
+
+/**
+ * Verifies a login password against the stored user record. Supports both
+ * the legacy unsalted-SHA256 hashes carried over from the old Apps Script
+ * system and the new salted-scrypt hashes. When a legacy hash still matches,
+ * returns an `upgrade` payload the caller should persist so the account is
+ * silently migrated to the stronger scheme on its next successful login.
+ */
+export async function verifyPassword(
+  password: string,
+  user: { password_hash: string; password_algo?: string | null; password_salt?: string | null }
+): Promise<{ ok: boolean; upgrade?: { hash: string; salt: string } }> {
+  if (user.password_algo === 'scrypt' && user.password_salt) {
+    const candidate = scryptSync(password, user.password_salt, SCRYPT_KEYLEN).toString('hex');
+    return { ok: timingSafeEqualHex(candidate, user.password_hash) };
+  }
+  const legacyHash = await sha256Hex(password);
+  if (!timingSafeEqualHex(legacyHash, user.password_hash)) {
+    return { ok: false };
+  }
+  return { ok: true, upgrade: hashPasswordStrong(password) };
+}
+
 export async function signSession(user: SessionUser): Promise<string> {
   return new SignJWT({ ...user })
     .setProtectedHeader({ alg: 'HS256' })
diff --git a/src/lib/db.ts b/src/lib/db.ts
index d9bc28f..c782e44 100644
--- a/src/lib/db.ts
+++ b/src/lib/db.ts
@@ -17,12 +17,17 @@ import {
 
 // ---------- Auth / users ----------
 
+/** Escapes ILIKE wildcard/escape characters so a username pattern only ever matches itself. */
+function escapeIlike(value: string): string {
+  return value.replace(/[\\%_]/g, (m) => `\\${m}`);
+}
+
 export async function findUserByUsername(username: string) {
   const supabase = getSupabase();
   const { data, error } = await supabase
     .from('users')
     .select('*')
-    .ilike('username', username.trim())
+    .ilike('username', escapeIlike(username.trim()))
     .maybeSingle();
   if (error) throw error;
   return data;
@@ -45,6 +50,30 @@ export async function insertLoginLog(entry: {
   });
 }
 
+/** Count of failed login attempts for a username within the trailing window — backs the login lockout. */
+export async function recentFailedLogins(username: string, sinceMinutesAgo: number): Promise<number> {
+  const supabase = getSupabase();
+  const since = new Date(Date.now() - sinceMinutesAgo * 60 * 1000).toISOString();
+  const { count, error } = await supabase
+    .from('login_log')
+    .select('id', { count: 'exact', head: true })
+    .ilike('username', escapeIlike(username.trim()))
+    .eq('result', 'fail')
+    .gte('ts', since);
+  if (error) throw error;
+  return count ?? 0;
+}
+
+/** System-initiated, silent upgrade of a legacy SHA-256 hash to salted scrypt after a successful login. */
+export async function upgradePasswordHash(id: string, passwordHash: string, passwordSalt: string): Promise<void> {
+  const supabase = getSupabase();
+  const { error } = await supabase
+    .from('users')
+    .update({ password_hash: passwordHash, password_salt: passwordSalt, password_algo: 'scrypt' })
+    .eq('id', id);
+  if (error) console.error('password upgrade error', error);
+}
+
 // ---------- Lookups ----------
 
 export async function listDealers(): Promise<Dealer[]> {
@@ -953,6 +982,7 @@ export async function createUserAdmin(
   input: {
     username: string;
     passwordHash: string;
+    passwordSalt: string;
     fullName: string;
     email: string | null;
     mobile: string | null;
@@ -968,6 +998,8 @@ export async function createUserAdmin(
     .insert({
       username: input.username,
       password_hash: input.passwordHash,
+      password_salt: input.passwordSalt,
+      password_algo: 'scrypt',
       full_name: input.fullName,
       email: input.email,
       mobile: input.mobile,
@@ -1017,11 +1049,22 @@ export async function updateUserAdmin(
   return data as AdminUser;
 }
 
-export async function resetUserPassword(id: string, passwordHash: string, session: SessionUser): Promise<void> {
+export async function resetUserPassword(
+  id: string,
+  passwordHash: string,
+  passwordSalt: string,
+  session: SessionUser
+): Promise<void> {
   const supabase = getSupabase();
   const { error } = await supabase
     .from('users')
-    .update({ password_hash: passwordHash, updated_by: session.username, updated_at: new Date().toISOString() })
+    .update({
+      password_hash: passwordHash,
+      password_salt: passwordSalt,
+      password_algo: 'scrypt',
+      updated_by: session.username,
+      updated_at: new Date().toISOString(),
+    })
     .eq('id', id);
   if (error) throw error;
 }
-- 
2.34.1

