# AI_CONTEXT.md
# MSEAL SERVICE SYSTEM
## AI Engineering Context

**Version:** 1.0  
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

Implementation Started

---

# Read Order

Every AI assistant must read documentation in the following order.

1.

docs/00_PROJECT/

- DEVELOPER_PORTAL.md
- KNOWLEDGE_INDEX.md

2.

docs/01_ARCHITECTURE/

- ARCHITECTURE_OVERVIEW.md
- ARCHITECTURE_PRINCIPLES.md
- ADR/*

3.

docs/03_PLATFORM/

- DATABASE_CATALOG.md
- API_CATALOG.md
- SHARED_COMPONENTS.md
- SHARED_SERVICES.md
- MASTER_DATA_CATALOG.md

4.

docs/05_ENGINEERING/

- ENGINEERING_HANDBOOK.md
- CODING_STANDARD.md
- CONTRIBUTING.md
- REVIEW_CHECKLIST.md

5.

Root

- DESIGN_SYSTEM.md
- COOKBOOK.md
- README.md
- REPORTS.md

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

1. Foundation
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

Sprint 10 Foundation

Priority 2

Master Data Integration

Priority 3

PM CRUD

Priority 4

Dashboard

Priority 5

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

Ready for Sprint 10

Status

READY FOR IMPLEMENTATION
