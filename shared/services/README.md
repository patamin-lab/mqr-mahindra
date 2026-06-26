# Platform Services

This directory hosts the platform's shared, cross-cutting services — capabilities every business module depends on but no module should implement individually. See `docs/PLATFORM_SERVICES.md` for full detail on each service's responsibilities, dependencies, boundaries, and reuse strategy, and `docs/ARCHITECTURE_PRINCIPLES.md` for how modules are expected to consume them.

**Status:** Documentation and architecture only (Sprint 5). No service implementation exists yet under this directory. Several services already have a partial, working equivalent elsewhere in the codebase (noted below) that a future sprint will migrate in, rather than rebuilding from scratch.

## Planned Services

| Folder | Responsibility | Existing Equivalent Today |
|---|---|---|
| `auth` | Identity and session management | `src/lib/auth.ts`, `src/lib/supabase.ts` |
| `upload` | Generic file upload handling (validation, normalization) | — (none yet) |
| `google-drive` | Google Drive integration: folders, uploads, links | `src/lib/googleDrive.ts`, `scripts/get-google-refresh-token.mjs` |
| `pdf` | PDF generation from structured data | `src/lib/exportPdf.tsx` |
| `synchronization` | Supabase → Google Sheets daily reporting sync | — (none yet; not the same as `src/lib/tractorSheet.ts`, see `docs/DATA_SYNCHRONIZATION.md`) |
| `scheduler` | Time-triggered recurring jobs | — (none yet) |
| `notification` | Outbound email and in-app notifications | `src/lib/email.ts` (Resend-based) |
| `audit` | Recording who did what, when, to which record | — (none yet) |
| `logging` | Structured application logging | — (none yet) |
| `monitoring` | Health checks and operational metrics | — (none yet) |
| `cache` | Short-lived caching for expensive/frequent reads | — (none yet) |
| `search` | Cross-entity and within-entity search behavior | — (none yet) |

## Why One README Instead of Twelve

Each service folder above does not yet contain its own code or stub README. This directory is documented as a single root README enumerating all twelve planned services, consistent with how `shared/ui/README.md` and `shared/admin/README.md` document their respective areas in Sprints 3 and 4. Individual per-service READMEs can be added when each service is actually implemented, at which point they can document real interfaces rather than placeholder folders.

## How a Module Should Use This Directory

A module imports from the relevant service's public interface once it exists; it does not reach into `src/lib/` equivalents directly once a service supersedes them, and it never re-implements a service's responsibility locally (see `docs/PRODUCT_PHILOSOPHY.md` — Reuse Before Create).
