# MASP — Mahindra After Sales Platform

Dealer-facing service platform for Mahindra tractors in Thailand. Release
1.0 covers two modules, both production-ready:

- **MQR (Market Quality Report)** — dealer quality-incident reporting,
  investigation workflow, and audit trail.
- **PM (Preventive Maintenance)** — search-first maintenance recording,
  Maintenance Due/Health/Compliance engines, and calculation-protection
  locking.

Future modules (NTR, PDI, Warranty, Campaign, Dashboard, AI Copilot) are
governed by the same engineering standards documented below and are built
one at a time, each behind its own release (see
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
