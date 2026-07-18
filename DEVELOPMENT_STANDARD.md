# Development Standard

Binding repository standard for branch work, review, validation, release, and
rollback. Detailed domain standards remain authoritative in
[`docs/standards/`](docs/standards/), especially
[`GIT_BRANCH_STANDARD.md`](docs/standards/GIT_BRANCH_STANDARD.md),
[`TESTING_STANDARD.md`](docs/standards/TESTING_STANDARD.md),
[`SECURITY_STANDARD.md`](docs/standards/SECURITY_STANDARD.md), and
[`MODULE_DEVELOPMENT_STANDARD.md`](docs/standards/MODULE_DEVELOPMENT_STANDARD.md).

## Branch strategy

Use `feature/*` for scoped features, `bugfix/*` for non-urgent fixes,
`hotfix/*` for urgent production fixes, and `release/*` for stabilization.
One issue per branch. Keep `main` production-deployable. Follow
`.claude/rules/git.md`; do not force-push, rewrite history, or create tags or
releases without explicit approval.

## Commit conventions

Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
One logical scope per commit. Never mix dependency, formatting-only, feature,
and unrelated cleanup. Update lockfile with dependency changes. Amend or
rewrite history only when explicitly authorized.

## Pull Request template

```markdown
## Objective

## Scope

## Out of scope

## Architecture and business-rule impact

## Implementation or design summary

## Compatibility and regression assessment

## Validation
- Architecture:
- Typecheck:
- Lint:
- Tests:
- Build:

## Documentation

## Risks and rollback

## Commit
```

## Code review checklist

- Scope is single-purpose and matches issue.
- Architecture ownership and ADR alignment are clear.
- No API, schema, storage, authorization, or business-rule drift.
- Authorization remains server-side and scope-safe.
- Existing contracts and legacy compatibility remain intact.
- No duplicate shared component, helper, state, or URL orchestration.
- Error, loading, retry, accessibility, localization, and mobile behavior considered.
- Tests cover changed behavior and regression path.
- Diff contains no debug code, secrets, generated artifacts, or unrelated edits.

## Architecture review checklist

- Read HANDOFF, ROADMAP, relevant ADR, architecture standard, and implementation.
- Identify owner for identity, authorization, storage, business logic, UI, and PDF.
- Confirm locked ADR-039 boundaries for image features.
- Treat ADR-040 as design-only; do not implement metadata infrastructure.
- Confirm dependency direction and absence of circular ownership.
- Record alternatives, tradeoffs, compatibility, migration, and rollback.
- Stop if architecture conflict cannot be resolved by existing ADR.

## Testing requirements

Add focused tests for changed behavior, defect regression, authorization,
compatibility, legacy records, error states, and boundary conditions. Use
existing Vitest patterns. UI changes also require manual authenticated smoke
verification when deployment environment is available. Never replace current
validation with historical results.

## Documentation requirements

Update only affected documents. Architecture changes require ADR and
architecture documentation. Current ownership/status changes require HANDOFF
and ROADMAP. Release changes require release notes and readiness report.
Developer-facing workflow changes belong in this standard, the playbook, or
AI guide with links instead of duplicated detailed rules.

## Validation requirements

Required gates, in current repository state:

1. Architecture
2. Typecheck
3. Lint
4. Tests
5. Build

Run `git diff --check`, repository audit, and working-tree review. On this
Windows OneDrive path, invoke underlying Node CLIs if npm shim path parsing
fails; see `HANDOFF.md`. Any failed gate blocks commit and release.

## Definition of Ready

- Objective, owner, acceptance criteria, and exclusions written.
- Relevant architecture, ADR, business rules, and current implementation read.
- No unresolved authorization, data ownership, or compatibility ambiguity.
- Design, test, validation, and rollback plan agreed.
- Change can be delivered incrementally without unrelated refactor.

## Definition of Done

- Scope implemented or documented exactly as approved.
- Production behavior and locked architecture preserved.
- Required tests and all five validation gates pass.
- Security, compatibility, regression, and rollback review complete.
- Documentation synchronized and links valid.
- Diff audited; working tree clean.
- Requested commit created, with hash reported.

## Repository audit checklist

- Search imports, exports, runtime references, dynamic references, and tests.
- Verify no compatibility dependency before deletion.
- Check no debug logging, commented-out code, conflict marker, TODO/FIXME,
  generated artifact, temporary file, accidental dependency, or unrelated file.
- Review complete staged diff.
- Confirm documentation status and links.
- Confirm `git status --short` clean after commit.

## Release checklist

- Architecture, Typecheck, Lint, Tests, Build PASS.
- Business rules, security, authorization, compatibility, and regression review PASS.
- HANDOFF, ROADMAP, ADR index, architecture docs, README, release notes, and
  readiness report synchronized where applicable.
- Production environment and manual smoke-test prerequisites confirmed.
- Rollback target and owner documented.
- Commit created only after final diff review.

## Rollback checklist

- Identify exact bad release and last known-good release.
- Confirm rollback does not require schema/storage reversal.
- Preserve attachment IDs, authorization, signed URL boundaries, and API contracts.
- Use deployment platform rollback procedure.
- Verify login, authorization, critical module flows, attachments, PDFs, and logs.
- Record incident, decision owner, validation evidence, and follow-up.

## Production deployment checklist

- Required environment variables and secrets verified outside git.
- Database migrations reviewed, additive, backed up, and independently reversible when applicable.
- Deployment target confirmed.
- Authenticated smoke tests run for affected modules.
- Error logs, attachment access, signed resources, PDFs, translations, and key business workflows checked.
- Release status and rollback decision recorded in the operational documents.

## Emergency hotfix procedure

1. Confirm production impact and severity.
2. Create `hotfix/<scope>` from production baseline.
3. Read HANDOFF, relevant ADRs, security rules, and owning implementation.
4. Make smallest safe fix; avoid redesign and unrelated cleanup.
5. Add regression test when feasible.
6. Run all required gates and focused smoke tests.
7. Review authorization, data integrity, compatibility, and rollback.
8. Obtain required approval, commit conventionally, deploy, verify, and record incident.

Emergency urgency does not waive architecture, security, or validation. If
rule or business ownership is unclear, stop and escalate.
