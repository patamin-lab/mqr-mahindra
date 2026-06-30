# AI_CONTEXT.md
# MSEAL SERVICE SYSTEM
## AI Engineering Context

**Version:** 1.1
**Status:** Active
**Last Updated:** 2026-06-30

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

Sprint 10.1 Foundation Complete

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

Refer to ADR documents for details.

---

# Current Sprint

Sprint 10

Objective

Implement the PM Record reference module.

Implementation Order

1. Foundation (Sprint 10.1 — Complete)
2. Master Data Integration
3. CRUD
4. Media Upload
5. Dashboard
6. PDF
7. Testing

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

Priority 1

Sprint 10.2 — Master Data Integration

Priority 2

PM CRUD

Priority 3

Dashboard

Priority 4

PDF

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

Sprint 10.1 Foundation

Complete

Status

READY FOR SPRINT 10.2
