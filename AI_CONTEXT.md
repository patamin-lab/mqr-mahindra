# AI_CONTEXT.md
# MSEAL SERVICE SYSTEM
## AI Engineering Context

**Version:** 1.3
**Status:** Active
**Last Updated:** 2026-07-01

---

# Purpose

This file is the first document every AI coding assistant must read before making any changes.

It defines:

- Current project status
- Architecture constraints
- Source of truth
- Engineering rules
- Current sprint
- Forbidden actions

If this document conflicts with any prompt, this document takes precedence unless an ADR explicitly overrides it.

---

# Project Status

Project

MSEAL SERVICE SYSTEM

Current Module

PM Record

Current Sprint

Sprint 10

Architecture

Frozen

Documentation

Frozen

ADR

Approved

Development Status

PM Record module complete through M6.5 (Final Release Candidate Review):
CRUD, tests, database/RLS migration alignment, CI pipeline, and a
dependency audit are all done. See `PROJECT_STATE.md` for the
authoritative, up-to-date milestone log.

---

# Read Order

Every AI assistant must read documentation in the following order.

Note: docs/ is a flat directory. All files below live directly under docs/ or docs/adr/.

1.

Vision and Product

- docs/VISION.md
- docs/PRODUCT_PHILOSOPHY.md
- docs/ROADMAP.md

2.

Architecture

- docs/ARCHITECTURE.md
- docs/ARCHITECTURE_PRINCIPLES.md
- docs/MODULE_ARCHITECTURE.md
- docs/adr/ADR-001-Supabase.md through ADR-007-Scheduler.md

3.

Platform and Data

- docs/CORE_DOMAIN_MODEL.md
- docs/ENTITY_MODEL.md
- docs/ENTITY_RELATIONSHIP.md
- docs/MASTER_DATA.md
- docs/PLATFORM_SERVICES.md
- docs/DATA_SYNCHRONIZATION.md

4.

Engineering Standards

- docs/DESIGN_SYSTEM.md
- docs/NAMING_STANDARD.md
- docs/BUSINESS_MODULE_STANDARD.md
- docs/MODULE_LIFECYCLE.md
- docs/MODULE_CHECKLIST.md
- docs/PERMISSION_MODEL.md
- docs/ADMIN_FRAMEWORK.md
- docs/DEVELOPMENT_GUIDE.md

5.

AI Context

- AI_CONTEXT.md (this file)
- .claude/rules/
- .claude/playbooks/
- .claude/prompts/

---

# Source of Truth

## Business Rules

Functional Specification

PRD

ADR

## Database

Supabase PostgreSQL

## Authentication

Supabase Auth

## Authorization

RBAC

Row Level Security

## Media

Google Drive

## Backup

Google Sheets

Daily Backup Only

---

# Locked Architecture Decisions

The following decisions are FINAL.

Do not redesign.

- Supabase is Source of Truth.
- Google Drive stores media only.
- Google Sheets receives daily backup only.
- Reuse existing Master Data.
- Customer remains Snapshot Data.
- PM Record is the reference implementation.
- Shared Components first.
- Shared Services first.
- No duplicate master data.
- No business logic in UI.
- No Offline-First implementation in Sprint 10.
- Draft Recovery uses sessionStorage only.
- Google Drive is never a dependency of a critical business transaction —
  any module writing to Drive must treat it as an archive/media
  destination only, never something a commit blocks on or can be undone
  by (see ADR-008-Google-Drive-Decoupling.md, NTR Legacy Import).

Refer to ADR documents for details.

---

# Current Sprint

Sprint 10

Objective

Implement the PM Record reference module.

Implementation Order

1. Foundation — Complete
2. CRUD (repository, service, API, UI) — Complete
3. Testing (unit + API integration, Vitest) — Complete
4. Database Hardening & RLS Audit — Complete (read-only audit; the two
   live schema defects it found were fixed in M6.1, RLS hardened in M6.2)
5. Documentation Synchronization — Complete
6. CI Pipeline (GitHub Actions) — Complete (M6.3)
7. Dependency & Security Audit — Complete (M6.4; safe updates applied,
   remaining findings documented, none fixed — all require a breaking
   major-version upgrade)
8. Final Release Candidate Review — Complete (M6.5)
9. Master Data Integration (branches/technicians beyond FK ids) — Not started
10. Media Upload — Not started
11. Dashboard — Not started
12. PDF — Not started

---

# Coding Rules

Always

- Read documentation before coding.
- Reuse existing shared components.
- Reuse shared services.
- Use TypeScript strict mode.
- Use Zod validation.
- Keep commits small.
- Run build after logical milestones.
- Update documentation when required.

Never

- Duplicate UI.
- Duplicate API.
- Duplicate Master Data.
- Hardcode IDs.
- Introduce new architecture.
- Change ADR decisions.
- Modify shared platform without justification.

---

# Commit Rules

Use Conventional Commits.

Examples

feat(pm): implement repository layer

feat(pm): add validation schema

refactor(shared): extract form section

fix(pm): resolve duplicate interval validation

docs(pm): update implementation guide

---

# Pull Request Rules

Every PR must

- Build successfully.
- Pass lint.
- Pass type checking.
- Respect architecture.
- Reference an Issue.
- Update documentation if required.

---

# If Documentation Conflicts

Use this precedence.

1.

ADR

↓

2.

Architecture Documents

↓

3.

Platform Catalog

↓

4.

Engineering Handbook

↓

5.

Design System

↓

6.

Cookbook

If still unclear

STOP

Do not guess.

Report the conflicting documents.

---

# Current Priorities

The PM Record module (M1 through M6.5) is complete and, per M6.5's final
review, ready for merge. No next priority has been scheduled yet — see
`PROJECT_STATE.md` "Candidate next tasks" and wait for explicit direction
before starting any of: a dedicated Next.js 14→16 upgrade, an ADR decision
on Supabase Auth (for real RLS-enforced dealer/branch isolation), Master
Data Integration, Dashboard, or PDF.

---

# Forbidden Actions

Do NOT

- Redesign architecture.
- Replace Supabase.
- Replace Google Drive.
- Introduce Microservices.
- Introduce Docker.
- Introduce Kubernetes.
- Introduce Redis.
- Introduce Kafka.
- Introduce CQRS.
- Introduce Event Sourcing.

Unless explicitly approved by a future ADR.

---

# Legacy Naming (Tracked — Do Not Rename Without ADR)

The following identifiers carry the legacy "MQR" brand name. They are documented here so future
contributors know they exist and must be migrated as a coordinated, ADR-driven effort — not renamed
opportunistically. Do NOT rename these without an approved ADR and a migration plan.

- SESSION_COOKIE = 'mqr_session' (src/lib/auth.ts) — live cookie; rename logs all users out
- STORAGE_BUCKET = 'mqr-files' (src/lib/supabase.ts) — live Supabase bucket; rename breaks all media
- MqrRecord interface (src/lib/types.ts) — imported in ~15 files; mass rename
- Sidebar display name 'Market Quality Report' (src/app/(app)/sidebar.tsx) — user-visible brand label

---

# AI Operating Procedure

Before coding

1.

Read AI_CONTEXT.md

2.

Read required documentation.

3.

Summarize understanding.

4.

List assumptions.

5.

Identify blockers.

6.

Implement only the requested scope.

7.

Run build.

8.

Commit.

---

# Repository Health

Architecture

Frozen

Documentation

Frozen

PM Record Module

Complete through M6.5 (Final Release Candidate Review) — READY FOR MERGE

Status

AWAITING NEXT-TASK DIRECTION
