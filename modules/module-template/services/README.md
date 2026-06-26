# services/

This module's data-access layer and its wiring into the shared platform services.

## Convention

- The module's own `db.ts`-equivalent lives here (`modules/template/service-template.md`'s convention, expressed as a folder rather than a single file so a module with several entities can split it, e.g. `services/partsRequests.ts`, `services/partsRequestLines.ts`).
- Built on `shared/services/` (`docs/PLATFORM_SERVICES.md`) for every cross-cutting concern — `auth`, `upload`, `google-drive`, `pdf`, `notification`, `audit`, `logging`, `cache`, `search` — never a second Supabase client, never a re-implementation of a platform service's responsibility (`docs/PRODUCT_PHILOSOPHY.md` — Reuse Before Create).
- Every query goes through `applyScope()` and respects RLS (`docs/MODULE_ARCHITECTURE.md` §4) — this is not optional and not something a module's service layer can bypass.
- A file here may be a thin module-specific wrapper around a shared service (e.g. a function that calls `shared/services/pdf` with this module's specific template), but the generation/upload/notification logic itself stays in the shared service, not duplicated here.

## Relationship to other docs

- `modules/template/service-template.md` — the Sprint 2 convention this folder implements.
- `docs/PLATFORM_SERVICES.md`, `shared/services/README.md` — what each shared service is responsible for and how to consume it.
- `docs/DATA_SYNCHRONIZATION.md`, `docs/GOOGLE_DRIVE_ARCHITECTURE.md` — the two services with the most detailed standalone architecture docs.

## Status

Empty. No platform service is implemented yet (`shared/services/README.md`), so this folder has nothing to wire into until that work happens (`docs/ROADMAP.md` Phase 2).
