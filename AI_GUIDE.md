# AI Guide

Operating guide for AI assistants working in MQR WebApp. This guide adds
workflow discipline; it does not override `HANDOFF.md`, accepted ADRs,
`.claude/rules/`, security standards, or current code.

## Repository context

MQR WebApp is a Next.js/TypeScript dealer-facing platform with MQR, PM, NTR,
PDI, Delivery, Vehicle360/Machine Passport, Knowledge, Attachment Platform,
PDF, translation, and shared services. `HANDOFF.md` is system source of truth.
`ROADMAP.md` is future scope. `docs/adr/README.md` is decision index.

Shared Image Platform v1 is implemented and locked by ADR-039. New image flows
must use `ImageItem`, `AttachmentResourceProvider`, `ImageThumbnail`,
`ImagePreview`, and `ImageViewer`. ADR-040 is proposed design only: do not
implement metadata, schema, API, storage, OCR, AI, crop, or versioning from it.

## Mandatory reading order

Before code or architecture work:

1. `HANDOFF.md`
2. `ROADMAP.md`
3. Relevant ADR and `docs/adr/README.md`
4. Relevant architecture document and `docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md`
5. Relevant standard under `docs/standards/`
6. Current implementation, tests, and configuration

For AI-specific operating rules also read
[`docs/governance/AI_ENGINEERING_PLAYBOOK.md`](docs/governance/AI_ENGINEERING_PLAYBOOK.md)
and `.claude/rules/`.

## Search strategy

Use `rg --files` to locate files and `rg -n -S` to locate symbols, imports,
routes, tests, TODO/FIXME, architecture boundaries, and documentation links.
Search before opening files. Read only files search proves relevant. Verify
references after every removal.

## Repository rules

- Preserve locked architecture and existing API/database/storage contracts.
- Keep authorization in AttachmentService/API/scope checks, never presentation.
- Keep business rules in current owners.
- Reuse shared components before creating new ones.
- Do not add debug logging, fake data, secrets, generated artifacts, or casual dependencies.
- Do not modify production code for documentation-only tasks.
- Do not commit, push, tag, or create PR unless task explicitly requests it.

## Coding and implementation rules

Architecture review precedes design; design precedes implementation. State
objective, scope, out of scope, affected owners, compatibility, tests, risks,
and rollback. Keep changes incremental. One issue, one branch, one logical
commit series. Stop when requested scope ends.

## Validation requirements

Every implementation must run Architecture, Typecheck, Lint, Tests, and Build
against current tree. Also run relevant regression, security, authorization,
compatibility, and manual smoke checks. If any required check fails, stop,
report exact failure, and do not commit.

## Repository audit process

Before deletion, search imports, exports, references, runtime usage, dynamic
imports, tests, compatibility adapters, and docs. Review diff for debug code,
temporary files, generated artifacts, dependency changes, conflict markers,
unrelated files, and new TODO/FIXME. Check `git status` and `git diff --check`.

## Documentation policy

Architecture change: update ADR, architecture docs, HANDOFF, ROADMAP, and
developer/release docs. Business-rule change: update owning rule documents.
Release change: update release notes and readiness report when applicable.
Historical docs may retain facts, but stale current status must be labeled.

## Commit, PR, and release conventions

Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
Commit only reviewed scope. PR description must include objective, scope,
out of scope, implementation/design summary, validation, regression risks,
documentation, and rollback. Release requires green gates, clean tree,
current handoff, release notes, readiness evidence, and explicit deployment
approval.

## Stop conditions

Stop immediately when architecture conflict, unclear business rule, possible
production behavior change outside scope, failed validation, uncertain repo
state, missing authority, or unverified deletion appears. Explain blocker and
wait. Do not silently redesign or continue into next PR/epic.

## Reporting format

Every completion report states:

- Summary
- Files changed
- Validation
- Risks and known limitations
- Outstanding work
- Working tree status
- Commit hash, if created

Never claim PASS from historical output. Report warnings separately from
failures.

## Prompt templates

### Architecture review

```text
Review [area] against [ADR/standard]. Search first. Do not implement.
Report current flow, ownership, violations, risks, recommendation, and PR breakdown.
```

### Design review

```text
Design [capability] only. State current architecture, locked boundaries,
proposed contracts, compatibility, migration, risks, validation, and ADR draft.
Do not change production code.
```

### Implementation

```text
Implement [single scope] following [ADR]. Read required docs first.
Do not change API/schema/business rules/storage unless explicitly listed.
Run all gates, audit diff, update docs, and stop after requested commit.
```

### Repository audit

```text
Audit [scope] with rg. Classify active, compatibility, dead, safe to remove,
and blocked findings. Do not remove code. Report exact references and risks.
```

### Production readiness

```text
Verify current repository only: architecture, typecheck, lint, tests, build,
docs, diff, artifacts, and working tree. Report blockers exactly. Do not claim ready without evidence.
```

### Release finalization

```text
Finalize [release] documentation only. Reconcile HANDOFF, ROADMAP, ADRs,
architecture, README, release notes, and readiness report. Run current gates.
Create exactly one requested conventional commit, then stop.
```

## Prompt quality

Good prompts define objective, scope, exclusions, authority, validation,
deliverables, commit rule, and stop condition. Bad prompts say “clean up
everything,” mix unrelated modules, imply architecture changes without ADR,
or request readiness without current validation evidence.
