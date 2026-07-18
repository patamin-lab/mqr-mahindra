# Engineering Playbook

Repository-wide workflow for production engineering. This is an operating
guide, not a replacement for an ADR, business rule, security rule, or API
standard. When sources disagree, code, schema, and accepted ADR decisions
take precedence; report the conflict before changing behavior.

Primary references: [`HANDOFF.md`](HANDOFF.md),
[`ROADMAP.md`](ROADMAP.md), [`DEVELOPMENT_STANDARD.md`](DEVELOPMENT_STANDARD.md),
[`docs/governance/AI_ENGINEERING_PLAYBOOK.md`](docs/governance/AI_ENGINEERING_PLAYBOOK.md),
[`docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md`](docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md),
and [`docs/adr/README.md`](docs/adr/README.md).

## Repository philosophy

Production stability outranks business rules, data integrity, security,
architecture, maintainability, performance, developer experience, and new
features, in that order. Prefer the smallest safe change. Reuse existing
platforms. Preserve compatibility. Never redesign locked architecture to
solve a local problem.

## Engineering lifecycle

1. Understand repository state and business context.
2. Search before reading or editing.
3. Review architecture, ADRs, ownership, and risks.
4. Write a small design and explicit scope boundary.
5. Implement only approved scope.
6. Validate with current repository checks.
7. Audit diff, references, security, and generated artifacts.
8. Synchronize documentation, release record, and handoff.
9. Commit only when requested and stop at task boundary.

## Architecture review process

Read `HANDOFF.md`, `ROADMAP.md`, relevant ADRs, architecture standards, and
current implementation. Identify ownership, dependencies, API/schema impact,
authorization boundaries, compatibility behavior, and rollback path.

Architecture is locked unless task explicitly reopens it. Shared Image
Platform v1 follows ADR-039: `ImageItem`, `AttachmentResourceProvider`, and
shared image primitives own presentation behavior; Attachment Platform owns
identity, authorization, storage, and signed-resource generation. ADR-040 is
design-only and approves no metadata implementation.

If proposed work changes architecture, schema, API, storage, authorization,
or business rules, stop and request an ADR or explicit scope decision.

## ADR process

Use an ADR for durable architectural decisions, boundary changes, new shared
platforms, schema/API contracts, or reopened locked architecture. ADR must
state context, decision, alternatives, consequences, migration, risks,
rollback, and status. Update ADR index, architecture docs, HANDOFF, ROADMAP,
and release notes when decision changes current repository behavior.

## Design review

Design review must state objective, in scope, out of scope, current state,
ownership, proposed flow, compatibility, security, performance, migration,
risks, validation, and PR breakdown. Design-only work must not silently create
production code, schema, API, or business behavior.

## Implementation workflow

Search with `rg` first. Read only relevant files. Reuse existing components,
services, providers, hooks, types, and tests. Keep authorization server-side,
business rules in their existing owners, storage behind Attachment Platform,
and UI free of domain authorization and direct storage access.

Do not add dependencies, APIs, database changes, migrations, or speculative
infrastructure unless explicitly approved. Add regression tests for every
fixed defect. Keep one logical scope per branch and commit.

## Validation workflow

Run against current tree, not historical claims:

- Architecture check
- Typecheck
- Lint
- Tests
- Build

On this Windows path, npm shim commands can fail because path contains `&`.
Use underlying Node entrypoints documented in `HANDOFF.md` when needed. A
failed gate stops work. Do not claim readiness while any required gate fails.

## Repository audit

Before removal, prove no imports, exports, references, runtime usage, or
compatibility dependency remain. Review complete diff for debug code, logging,
commented-out production code, conflict markers, generated artifacts,
dependency drift, unrelated files, and introduced TODO/FIXME. Check working
tree status and documentation links.

## Documentation requirements

Update only documents affected by change. Architecture changes require ADR,
architecture docs, HANDOFF, ROADMAP, developer guidance, and release notes
when applicable. Every release-facing change needs current validation and
known-risk records. Preserve historical records, but label superseded status.

## Release process

1. Confirm scope and release owner.
2. Run all validation gates.
3. Complete repository and documentation audit.
4. Confirm production checklist and manual smoke-test requirements.
5. Prepare release notes and rollback plan.
6. Create one conventional commit if requested.
7. Stop. Deployment, tag, push, and PR require explicit authorization.

## Rollback strategy

Application rollback uses the deployment platform's last known-good version.
Follow [`docs/deployment/DEPLOYMENT_GUIDE.md`](docs/deployment/DEPLOYMENT_GUIDE.md)
and [`docs/operations/OPERATIONS_RUNBOOK.md`](docs/operations/OPERATIONS_RUNBOOK.md).
Never roll back database or storage state casually. Add migration-specific
rollback steps before any schema change. Preserve attachment identity,
authorization, and existing URLs during application rollback.

## Production readiness

Ready means Architecture, Typecheck, Lint, Tests, Build, documentation,
security review, compatibility review, regression assessment, rollback plan,
and working tree audit all pass. Live deployment and authenticated smoke tests
remain separate operational gates.

## Definition of Ready

- Objective, owner, scope, and out-of-scope behavior are explicit.
- Current implementation and relevant ADRs are understood.
- Business rules, authorization, data ownership, and compatibility are known.
- Architecture impact and rollback path are reviewed.
- Test and validation plan exists.

## Definition of Done

- Approved scope implemented without unrelated changes.
- Production behavior, business rules, security, and compatibility preserved.
- Architecture, typecheck, lint, tests, and build pass.
- Diff and repository audit complete.
- Required documentation and release records synchronized.
- Working tree clean and commit created only when requested.

## Decision making principles

Prefer evidence over assumption, reversible changes over destructive changes,
explicit ownership over duplication, compatibility over convenience, and
incremental PRs over broad migrations. Unclear business rule or architecture
conflict means stop and escalate.

## Repository ownership

Business modules own domain mapping and workflows. Shared platform owners own
cross-module capabilities. AttachmentService/API own attachment authorization
and storage boundaries. ADR owners maintain decisions; engineering owners keep
HANDOFF and ROADMAP current. Reviewers own validation and release evidence.

## Long-term maintenance

Keep one source of truth per concern. Retire compatibility layers only after
repository-wide usage proof and focused regression validation. Keep standards
short, linked, and current. Do not build future infrastructure without a
current business requirement and approved design.
