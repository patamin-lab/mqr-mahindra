# MASP — Mahindra After Sales Platform

Dealer-facing service platform for Mahindra tractors in Thailand. Initial
v1.0 release covered two production-ready modules:

- **MQR (Market Quality Report)** — dealer quality-incident reporting,
  investigation workflow, and audit trail.
- **PM (Preventive Maintenance)** — search-first maintenance recording,
  Maintenance Due/Health/Compliance engines, and calculation-protection
  locking.

Current release: **v2.4.0 — Shared Image Platform v1**. Platform adoption,
governance, validation, limitations, and deployment notes are recorded in
[`docs/releases/RELEASE_NOTES_SHARED_IMAGE_PLATFORM_V2.4.0.md`](docs/releases/RELEASE_NOTES_SHARED_IMAGE_PLATFORM_V2.4.0.md)
and [`docs/releases/PRODUCTION_READINESS_REPORT.md`](docs/releases/PRODUCTION_READINESS_REPORT.md).

Future capabilities (Warranty expansion, Campaign, Dashboard extensions, and
AI Copilot) are governed by the same engineering standards documented below
and are built one at a time, each behind its own release (see
[`docs/standards/GIT_BRANCH_STANDARD.md`](docs/standards/GIT_BRANCH_STANDARD.md)'s
Semantic Versioning policy).

## Tech stack

Next.js 14 (App Router, TypeScript) · Supabase (Postgres, RLS, primary
attachment storage) · Google Drive (attachment archive) · Resend (email)
· Tailwind CSS · Vitest. Full detail: [`CLAUDE.md`](CLAUDE.md),
[`docs/TECH_STACK.md`](docs/TECH_STACK.md),
[`docs/PLATFORM_BASELINE.md`](docs/PLATFORM_BASELINE.md).

## Getting started

```
npm install
npm run dev        # local dev server
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run test        # vitest run
npm run build       # next build
```

> On this repo's path (containing `&`), `npm run <script>` can fail under
> `cmd.exe`. If it does, invoke the underlying binary directly, e.g.
> `node "./node_modules/vitest/vitest.mjs" run` — see `CLAUDE.md`'s known
> gotchas.

## Documentation

**Start at [`docs/INDEX.md`](docs/INDEX.md)** — the entry point to every
engineering document in this repository.

Most directly useful for someone about to write code:

- [`docs/releases/PRODUCTION_READINESS_REPORT.md`](docs/releases/PRODUCTION_READINESS_REPORT.md)
  — current handoff status, validation results, risks, and known limitations.
- [`docs/architecture/SHARED_IMAGE_PLATFORM_V1.md`](docs/architecture/SHARED_IMAGE_PLATFORM_V1.md)
  — the completed, locked shared image platform release.
- [`docs/releases/RELEASE_NOTES_SHARED_IMAGE_PLATFORM_V2.4.0.md`](docs/releases/RELEASE_NOTES_SHARED_IMAGE_PLATFORM_V2.4.0.md)
  — v2.4.0 release summary, validation, limitations, and deployment notes.
- [`CLAUDE.md`](CLAUDE.md) — what this system does, schema, RBAC, deployment.
- [`docs/standards/MODULE_DEVELOPMENT_STANDARD.md`](docs/standards/MODULE_DEVELOPMENT_STANDARD.md) — how every module is built.
- [`docs/standards/API_STANDARD.md`](docs/standards/API_STANDARD.md) — request/response, pagination, error shape.
- [`docs/standards/DATABASE_STANDARD.md`](docs/standards/DATABASE_STANDARD.md) — schema, keys, soft delete, dealer scope.
- [`docs/standards/SECURITY_STANDARD.md`](docs/standards/SECURITY_STANDARD.md) — dealer isolation, RBAC, auth.
- [`docs/standards/TESTING_STANDARD.md`](docs/standards/TESTING_STANDARD.md) — what and how to test.
- [`docs/standards/GIT_BRANCH_STANDARD.md`](docs/standards/GIT_BRANCH_STANDARD.md) — branching, versioning, PR gates.
- [`docs/standards/DOMAIN_LANGUAGE_STANDARD.md`](docs/standards/DOMAIN_LANGUAGE_STANDARD.md) — business terminology, Dealer Standard.
- [`docs/standards/UI_COMPONENT_STANDARD.md`](docs/standards/UI_COMPONENT_STANDARD.md) — design tokens, shared components.
- [`docs/releases/RELEASE_CHECKLIST_V1.md`](docs/releases/RELEASE_CHECKLIST_V1.md) — pre-deployment checklist.

## AI agent guidance

If you're an AI coding assistant working in this repo, read
[`.claude/CLAUDE.md`](.claude/CLAUDE.md) and `.claude/rules/` before making
any change — they govern git safety, data-access security, coding
standards, and UI conventions on top of everything above.
