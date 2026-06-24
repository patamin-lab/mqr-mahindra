From f2108417039544b94b2cf24ee88e751d6298a0c1 Mon Sep 17 00:00:00 2001
From: patamin-lab <patamin@gmail.com>
Date: Wed, 24 Jun 2026 04:04:37 +0000
Subject: [PATCH] Fix: normalize empty-string dealer_id to null on user
 create/edit
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit

The admin Users UI's 'ไม่ระบุดีลเลอร์ (ส่วนกลาง)' option submits dealer_id
as '' rather than omitting it. The API only coalesced null/undefined to
null (?? null), so '' passed through unchanged and hit the
users_dealer_id_fkey constraint (dealers.id has no '' row). Use || null
instead so both create and edit normalize '' to a real NULL.
---
 src/app/api/admin/users/[id]/route.ts | 3 ++-
 src/app/api/admin/users/route.ts      | 3 ++-
 2 files changed, 4 insertions(+), 2 deletions(-)

diff --git a/src/app/api/admin/users/[id]/route.ts b/src/app/api/admin/users/[id]/route.ts
index 298a1ee..0919ffd 100644
--- a/src/app/api/admin/users/[id]/route.ts
+++ b/src/app/api/admin/users/[id]/route.ts
@@ -34,7 +34,8 @@ export async function PATCH(req: NextRequest, { params }: { params: { id: string
       }
       patch.role = newRole;
     }
-    if (seesAllDealers(session.role) && body.dealer_id !== undefined) patch.dealerId = body.dealer_id;
+    // Normalize the "central / no dealer" option, which the admin UI submits as ''.
+    if (seesAllDealers(session.role) && body.dealer_id !== undefined) patch.dealerId = body.dealer_id || null;
 
     const user = await updateUserAdmin(params.id, patch, session);
     return NextResponse.json({ ok: true, user });
diff --git a/src/app/api/admin/users/route.ts b/src/app/api/admin/users/route.ts
index 235b7d1..4722e28 100644
--- a/src/app/api/admin/users/route.ts
+++ b/src/app/api/admin/users/route.ts
@@ -44,7 +44,8 @@ export async function POST(req: NextRequest) {
     }
 
     // Dealer Admin may only create users inside their own dealer.
-    const dealerId = seesAllDealers(session.role) ? (body.dealer_id ?? null) : session.dealerId;
+    // Normalize the "central / no dealer" option, which the admin UI submits as ''.
+    const dealerId = seesAllDealers(session.role) ? (body.dealer_id || null) : session.dealerId;
 
     const { hash: passwordHash, salt: passwordSalt } = hashPasswordStrong(password);
     const user = await createUserAdmin(
-- 
2.34.1

