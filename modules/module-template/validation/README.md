# validation/

Input validation for this module — used from both a page (immediate client-side feedback) and the matching API route (independent server-side re-validation).

## Convention

- One validation function/schema per form or per entity, named after what it validates: `validatePartsRequestInput()`.
- Every check defined here must be called from **both** places independently: the page, for UX, and the API route, for enforcement. `docs/MODULE_ARCHITECTURE.md` §3 is explicit that a route never trusts that the page already validated — re-checking server-side is not optional, regardless of what the calling page did.
- Today's pattern across the codebase is hand-written client/server validation (`modules/template/validation-template.md`). Whether to adopt a schema library (zod) is a flagged, undecided gap (`docs/ROADMAP.md` open questions) — this folder does not pre-empt that decision; write validation in today's hand-written style until/unless a future sprint changes the standard.

## Relationship to other docs

- `modules/template/validation-template.md` — the Sprint 2 convention this folder implements.
- `docs/MODULE_ARCHITECTURE.md` §3 — the two-layer (client + server) re-validation requirement.
- `docs/ROADMAP.md` — open question on schema-validation tooling.

## Status

Empty. No module validation is written yet.
