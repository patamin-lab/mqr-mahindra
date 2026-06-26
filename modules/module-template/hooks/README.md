# hooks/

Client-side React hooks local to this module — state and data-fetching glue that a module's components need, that isn't generic enough to be a shared hook.

## Convention

- `useXxx` naming, camelCase: `usePartsRequestDraft.ts`.
- A hook starts here for the same reason a component starts in `components/`: it only moves to a shared location once a second module needs the same behavior. There is no `shared/hooks/` yet — if and when a hook is needed by two modules, that's the trigger to create one, mirroring the promotion rule in `docs/MODULE_ARCHITECTURE.md` §5.
- A hook here calls into `services/` for data, never directly into Supabase or a platform service — keeps the data-access boundary in one place per module.
- This is a new convention layer as of Sprint 6 — Sprint 2's `docs/MODULE_ARCHITECTURE.md` did not define one because no module existed yet to need it. Treat it as binding the same way the rest of that document is.

## Relationship to other docs

- `docs/MODULE_ARCHITECTURE.md` §5 — the promotion-to-shared rule this folder follows by analogy.
- `services/README.md` (this template) — what a hook here is allowed to call.

## Status

Empty. No module exists yet to need a hook.
