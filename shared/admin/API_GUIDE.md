# API Guide

The request/response contract every `/api/admin/*` route follows today,
read in full from `dealers/route.ts`, `dealers/[id]/route.ts`,
`problem-codes/[id]/route.ts`, and `users/[id]/route.ts`. See
`docs/ADMIN_FRAMEWORK.md` §4 for the supporting evidence.

## Request handling order (every route, no exception found)

1. `const session = await getSession();`
   → if missing: `NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })`
2. One `src/lib/scope.ts` predicate on `session.role` (and, for Users'
   PATCH, on the target record's role too):
   → if it fails: `NextResponse.json({ ok: false, error: '<Thai message>' }, { status: 403 })`
3. For mutating methods, the body is parsed and validated inside a `try`
   block. Validation failures return `{ ok: false, error: '<Thai message>' }`
   with **no special status code** — observed as a plain `200` in
   `dealers/route.ts`'s POST handler. This is a real inconsistency in the
   existing code (sloppy, not a deliberate convention) and is called out
   here rather than silently treated as the recommended pattern — see
   "Recommendations" below.
4. Exactly one `src/lib/db.ts` function is called, with `session` passed
   through (e.g. `createDealer(data, session)`, `updateUserAdmin(id, patch,
   session)`, `deleteUserAdmin(id, session)`).
5. Success: `NextResponse.json({ ok: true, <entityKey>: result })`.
6. `catch (err: any)`: `console.error('<verb> <entity> error', err)`, then
   `NextResponse.json({ ok: false, error: err?.message ?? '<Thai fallback>' }, { status: 500 })`.

## Response envelope

Every response, success or failure, is `{ ok: boolean, error?: string,
<entityKey>?: T }`. The `<entityKey>` name matches the singular entity
(`dealer`, `user`) on single-record responses and the plural (`dealers`,
`users`) on list responses. This is fully consistent across every route
read and should be treated as fixed.

## Method matrix (confirmed vs. presumed — see ADMIN_FRAMEWORK.md §4)

| Route | GET | POST | PATCH | DELETE |
|---|---|---|---|---|
| `/api/admin/dealers` | list (confirmed) | create (confirmed) | — | — |
| `/api/admin/dealers/[id]` | — | — | update incl. `active` (confirmed) | — (no handler — confirmed absent) |
| `/api/admin/problem-codes/[id]` | — | — | update incl. `active` (confirmed) | — (no handler — confirmed absent) |
| `/api/admin/users` | list (confirmed) | create (confirmed) | — | — |
| `/api/admin/users/[id]` | — | — | role-aware update (confirmed) | yes, SuperAdmin-only (confirmed) |
| `/api/admin/users/[id]/reset-password` | — | presumed POST (folder confirmed, handler not opened) | — | — |
| `/api/admin/branches`, `/api/admin/branches/[id]` | presumed | presumed | presumed | presumed none |
| `/api/admin/technicians`, `/api/admin/technicians/[id]` | presumed | presumed | presumed | presumed none |

Users is the only module with a hard `DELETE`, gated by `canDeleteUsers`
(SuperAdmin only) and with a nested action route for password resets.
Every other confirmed module uses an `active: boolean` PATCH field as a
soft-delete substitute instead of exposing removal.

## Recommendations for new or future routes

- Keep the envelope and the 401-then-403-then-handler ordering exactly as
  is — it's the one thing that's already perfectly consistent and any
  shared layer should encode it rather than reinvent it.
- Prefer returning `422` (or at minimum a non-`200` status) for body
  validation failures in new routes, rather than repeating the existing
  `200`-with-`ok:false` pattern found in `dealers/route.ts`. This is a
  forward-looking suggestion, not a request to change the existing route.
- New non-CRUD behavior (anything like password reset) should be a nested
  route under `[id]/`, following the one precedent that already exists,
  rather than overloading `PATCH` with action-flag fields in the body.
- Any generic API client built against this contract should treat
  `ok: false` as the only reliable failure signal and not branch on HTTP
  status codes, since at least one route conflates `200` with a logical
  failure.
