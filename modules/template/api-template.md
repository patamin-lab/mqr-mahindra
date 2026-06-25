# Template: API routes

Convention for a module's API route handlers, matching every existing
route under today's `src/app/api/*`.

## Envelope

Every response is one of:

```
{ ok: true, ...data }
{ ok: false, error: string }
```

No other response shape. No bare arrays, no HTTP-status-only errors with
an empty body — the client (`shared/fetchJson`) expects this envelope
unconditionally.

## Re-validation rule (non-negotiable)

An API route never trusts the client's belief about its own session, role,
or scope, even though the page that called it already checked these
things. Every route independently:

1. Re-validates the session cookie.
2. Re-derives the caller's scope (dealer/branch/role) server-side.
3. Applies `applyScope()` to the query/mutation itself — RLS is the second,
   independent layer underneath that, not a substitute for this step.

This is the same defense-in-depth rule as `docs/ARCHITECTURE.md` §5 and
`.claude/rules/03-data-access-security.md` — a module's routes don't get an
exception.

## Resource routing convention

REST-ish, resource-noun-based, matching today's `admin/dealers`,
`admin/branches`, etc.:

```
api/<module>/<resource>          GET (list), POST (create)
api/<module>/<resource>/[id]     GET (one), PATCH (update), DELETE (soft-delete)
```

## What this template does not cover

Where validation logic lives (see `validation-template.md`) and how a
module's permissions gate which routes a caller may even reach (see
`docs/MODULE_ARCHITECTURE.md` §"Permissions").
