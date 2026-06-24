From dbb73d4ff7108126dccbffdddc5aca8c9b56e436 Mon Sep 17 00:00:00 2001
From: patamin-lab <patamin@gmail.com>
Date: Wed, 24 Jun 2026 04:34:23 +0000
Subject: [PATCH] Use MSEAL as the central/no-dealer placeholder instead of
 null
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit

The 'ไม่ระบุดีลเลอร์ (ส่วนกลาง)' option still submits '', but the API now
stores it as dealer_id='MSEAL' (a real dealers row representing central/
HQ) instead of null. Cleaner than null: central users now resolve to a
real dealer record everywhere the app does a dealers lookup/join.

DB-side (already applied directly to Supabase, no migration file needed
since this is just data, not schema):
- Inserted dealers row id='MSEAL', short_name='MSEAL', full_name='ส่วนกลาง (MSEAL)'.
- Backfilled the one existing user with dealer_id IS NULL (admin.central) to 'MSEAL'.
---
 src/app/api/admin/users/[id]/route.ts | 5 +++--
 src/app/api/admin/users/route.ts      | 6 ++++--
 2 files changed, 7 insertions(+), 4 deletions(-)

diff --git a/src/app/api/admin/users/[id]/route.ts b/src/app/api/admin/users/[id]/route.ts
index 0919ffd..daccb01 100644
--- a/src/app/api/admin/users/[id]/route.ts
+++ b/src/app/api/admin/users/[id]/route.ts
@@ -34,8 +34,9 @@ export async function PATCH(req: NextRequest, { params }: { params: { id: string
       }
       patch.role = newRole;
     }
-    // Normalize the "central / no dealer" option, which the admin UI submits as ''.
-    if (seesAllDealers(session.role) && body.dealer_id !== undefined) patch.dealerId = body.dealer_id || null;
+    // The "central / no dealer" option submits ''. Store the dedicated
+    // MSEAL (central) dealer row instead of null — see admin/users/route.ts.
+    if (seesAllDealers(session.role) && body.dealer_id !== undefined) patch.dealerId = body.dealer_id || 'MSEAL';
 
     const user = await updateUserAdmin(params.id, patch, session);
     return NextResponse.json({ ok: true, user });
diff --git a/src/app/api/admin/users/route.ts b/src/app/api/admin/users/route.ts
index 4722e28..a9db701 100644
--- a/src/app/api/admin/users/route.ts
+++ b/src/app/api/admin/users/route.ts
@@ -44,8 +44,10 @@ export async function POST(req: NextRequest) {
     }
 
     // Dealer Admin may only create users inside their own dealer.
-    // Normalize the "central / no dealer" option, which the admin UI submits as ''.
-    const dealerId = seesAllDealers(session.role) ? (body.dealer_id || null) : session.dealerId;
+    // The "central / no dealer" option submits ''. Store the dedicated
+    // MSEAL (central) dealer row instead of null so dealer_id is always a
+    // valid FK and central staff still show up under a real dealer.
+    const dealerId = seesAllDealers(session.role) ? (body.dealer_id || 'MSEAL') : session.dealerId;
 
     const { hash: passwordHash, salt: passwordSalt } = hashPasswordStrong(password);
     const user = await createUserAdmin(
-- 
2.34.1

