# shared/

Status: **empty — scaffolding only (Sprint 1).** No code has been moved here yet.

## Purpose

This is the planned home for cross-module code: anything two or more
business modules need, with **zero dependency on any specific module**.
It is the eventual destination for most of today's `src/lib/*`.

## Planned contents (Sprint 2, not yet moved)

| Today (`src/lib/`) | Future (`shared/`) | What it is |
|---|---|---|
| `auth.ts` | `shared/auth/` | JWT session sign/verify, cookie helpers |
| `scope.ts` | `shared/auth/scope.ts` | RBAC predicates (`SuperAdmin > CentralAdmin > DealerAdmin > DealerUser`) |
| `db.ts` (connection + cross-cutting helpers only) | `shared/db/client.ts` | Supabase client, `applyScope()`, soft-delete helpers |
| `fetchJson.ts` | `shared/http/fetchJson.ts` | Client-side fetch wrapper with uniform error handling |
| `swal.ts` | `shared/ui/swal.ts` | The app-wide SweetAlert2 feedback wrapper |
| `thaiDate.ts` | `shared/i18n/thaiDate.ts` | GMT+7 / Buddhist-year date formatting |
| `googleDrive.ts` | `shared/storage/googleDrive.ts` | Drive upload/resumable-session/relocate helpers, behind a storage interface so a future module could swap backends |
| `email.ts` | `shared/notify/email.ts` | Resend wrapper |
| `types.ts` (generic pieces only) | `shared/types/` | `Role`, `SessionUser`, shared enums — module-specific record shapes (e.g. `MqrRecord`) stay with their module |
| dashboard chart wrappers (`dashboard/charts.tsx`) | `shared/components/charts/` | Generic recharts wrappers (`SimpleBarChart`, `StatusBarChart`, etc.) — already generic today, just not relocated |
| `KpiCard`/`Panel` (inline in `dashboard/page.tsx`) | `shared/components/ui/` | Not yet extracted into their own files at all — extraction happens before relocation |

## Rules

- Nothing in `shared/` may import from `modules/<anything>`. Dependencies flow
  one way: `modules/* → shared/*`, never the reverse.
- Code only moves here as part of an explicit migration sprint (see
  `docs/ROADMAP.md`, Sprint 2) — not opportunistically, so every move stays
  reviewable as a clean, mechanical diff with no behavior change.
- Module-specific logic (warranty math, MQR's severity taxonomy, etc.) does
  **not** belong here even if only one module currently uses it, unless a
  second module is expected to need it soon (e.g. `calcWarranty()` is a
  reasonable shared candidate because Warranty-the-module will need it too).
