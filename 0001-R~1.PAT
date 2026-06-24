From 2db1241d7c7627faeedf868bde8b4bc2673c672a Mon Sep 17 00:00:00 2001
From: patamin-lab <patamin@gmail.com>
Date: Wed, 24 Jun 2026 04:42:15 +0000
Subject: [PATCH] =?UTF-8?q?Remove=20'=E0=B9=84=E0=B8=A1=E0=B9=88=E0=B8=A3?=
 =?UTF-8?q?=E0=B8=B0=E0=B8=9A=E0=B8=B8=E0=B8=94=E0=B8=B5=E0=B8=A5=E0=B9=80?=
 =?UTF-8?q?=E0=B8=A5=E0=B8=AD=E0=B8=A3=E0=B9=8C=20(=E0=B8=AA=E0=B9=88?=
 =?UTF-8?q?=E0=B8=A7=E0=B8=99=E0=B8=81=E0=B8=A5=E0=B8=B2=E0=B8=87)'=20opti?=
 =?UTF-8?q?on=20from=20the=20user-create=20dealer=20dropdown?=
MIME-Version: 1.0
Content-Type: text/plain; charset=UTF-8
Content-Transfer-Encoding: 8bit

MSEAL is now a real dealers row, so it just shows up in the normal
dealers list instead of needing a separate blank/placeholder option.
Defaults the create-form dealer field to MSEAL.
---
 src/app/(app)/admin/users/users-table.tsx | 3 +--
 1 file changed, 1 insertion(+), 2 deletions(-)

diff --git a/src/app/(app)/admin/users/users-table.tsx b/src/app/(app)/admin/users/users-table.tsx
index 0d58662..de757e7 100644
--- a/src/app/(app)/admin/users/users-table.tsx
+++ b/src/app/(app)/admin/users/users-table.tsx
@@ -33,7 +33,7 @@ export default function UsersTable({
     email: '',
     mobile: '',
     role: myAssignableRoles[myAssignableRoles.length - 1] ?? 'DealerUser',
-    dealer_id: lockedDealerId ?? '',
+    dealer_id: lockedDealerId ?? 'MSEAL',
     branch: '',
   });
 
@@ -137,7 +137,6 @@ export default function UsersTable({
         <input className="border rounded px-2 py-1.5 text-sm" placeholder="สาขา (ถ้ามี)" value={newUser.branch} onChange={(e) => setNewUser({ ...newUser, branch: e.target.value })} />
         {!lockedDealerId ? (
           <select className="border rounded px-2 py-1.5 text-sm" value={newUser.dealer_id} onChange={(e) => setNewUser({ ...newUser, dealer_id: e.target.value })}>
-            <option value="">ไม่ระบุดีลเลอร์ (ส่วนกลาง)</option>
             {dealers.map((d) => (
               <option key={d.id} value={d.id}>
                 {d.short_name}
-- 
2.34.1

