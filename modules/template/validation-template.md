# Template: validation

Convention for input validation in a module, given the current state of
the codebase: **no schema-validation library** (no zod/yup) is in use
anywhere yet — this is a documented, flagged gap, not a recommendation to
introduce one inside a module unilaterally (see `docs/ROADMAP.md` open
questions).

## Current pattern (until the gap above is deliberately addressed)

Validation is hand-written and intentionally duplicated:

- **Client-side** validation in the form component is for UX only (instant
  feedback, no round-trip) — it is never the authoritative check.
- **Server-side** validation, inside the API route or the service layer
  before any write, is the one that matters for security and data
  integrity. It re-checks everything the client already checked, plus
  anything the client can't be trusted to check at all (ownership, scope,
  uniqueness against the database).

A module's validation logic lives alongside its service layer
(`service-template.md`) or its API route handlers (`api-template.md`) —
not in a separate `modules/<name>/validation.ts` file unless the module
has enough resources that co-locating it everywhere gets unwieldy, in
which case a single shared file *within that module* is fine.

## Rule

Do not introduce zod (or any other schema-validation library) inside a
single module as a one-off. That decision is tracked as an open
architecture question in `docs/ROADMAP.md` precisely because it should be
made once, for every module consistently, not module-by-module.
