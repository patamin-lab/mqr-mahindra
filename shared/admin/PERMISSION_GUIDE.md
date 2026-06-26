# Permission Guide

How every admin module is gated, sourced entirely from
`src/lib/scope.ts` (51 lines, read in full from the live `main` branch).
See `docs/ADMIN_FRAMEWORK.md` §3 for the supporting evidence.

## Single source of truth

`scope.ts` exports pure functions over a four-value `Role`:
`SuperAdmin`, `CentralAdmin`, `DealerAdmin`, `DealerUser`. No admin page or
route defines its own role-checking logic — every check, in every
`page.tsx` and every `route.ts` read this sprint, calls one of these
functions. There is no duplicated or parallel permission logic anywhere in
the admin modules.

| Function | Signature | Used by |
|---|---|---|
| `seesAllDealers` | `(role) => boolean` | Dealers page/route gate; decides whether Branches/Users/Technicians data is fetched unscoped or filtered to `session.dealerId` |
| `canManageMasterData` | `(role) => boolean` | Branches page gate (presumed also Technicians/Problem Codes) |
| `canManageUsers` | `(role) => boolean` | Users page/route gate |
| `canDeleteUsers` | `(role) => boolean` | Users `DELETE` handler gate — SuperAdmin only |
| `canManageRoleTarget` | `(actorRole, targetRole) => boolean` | Users `PATCH` — the only check in the entire admin framework that depends on a second role value, not just the caller's |
| `assignableRoles` | `(actorRole) => Role[]` | Users create/edit — which `role` values the actor may assign to anyone |
| `roleLabelTh` | `Record<Role, string>` | Thai display label, used in `users-table.tsx` |
| `canExport`, `canUpdateStatus`, `canDelete`, `canManageParts`, `canCreateSuperAdmin` | various | Defined in the same file; not exercised by the 5 admin modules covered in this sprint, listed for completeness |

## The two-layer check

Every module checks permission twice, in two different places, for two
different reasons:

1. **`page.tsx` (UX gate)** — `if (!predicate(session.role))
   redirect('/dashboard')`. This exists so an unauthorized user never sees
   the page render at all.
2. **`route.ts` (enforcement gate)** — the identical predicate, called
   again, independently, server-side, returning `403` if it fails. This is
   what actually stops an unauthorized request — confirmed present in
   `dealers/route.ts` and `problem-codes/[id]/route.ts` even though both
   modules' pages already gate access. The API does not trust the page to
   have done this.

Any shared abstraction must preserve both checks as separate calls. A
single shared "isAuthorized" memo computed once in a layout and threaded
down would silently remove the server-side enforcement layer's
independence — a real regression in defense-in-depth, not just a style
change.

## Row-level (target-aware) authorization — Users only

Every other module's checks are a pure function of `session.role` alone.
Users is the exception: editing another user's `role` field requires
`canManageRoleTarget(actorRole, targetRole)`, which looks at *both* the
acting user's role and the role of the record being modified. This is
what stops, for example, a `CentralAdmin` from elevating or modifying a
`SuperAdmin` account, even though `CentralAdmin` passes the module-level
`canManageUsers` check that gates access to the Users page at all.

This matters directly for the proposed `<AdminCrud>` component
(`docs/ADMIN_FRAMEWORK.md` §7): a `permissions` prop shaped as `(role) =>
boolean` is sufficient for Dealers, Branches, Technicians, and Problem
Codes, but is **not** sufficient for Users, which needs the target record
in scope for at least one check. `docs/ADMIN_FRAMEWORK.md` §9 recommends
building and validating the generic component against the four simpler
modules first, and treating Users as a deliberately separate, later step
specifically because of this gap.

## Client-side reuse, not duplication

`users-table.tsx` calls `assignableRoles(actorRole)` and
`canDeleteUsers(actorRole)` client-side to decide which roles can be
offered in a `<select>` and whether a delete button renders at all. This
is the same `scope.ts` functions being reused for UI purposes, not a
second implementation of the logic — the server-side route still
independently re-checks every one of these before acting, per the
two-layer pattern above. This is correct use of the shared module, and
should be the template for any future client-side permission UI: import
the existing function, don't re-derive the rule.
