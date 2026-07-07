# Release Notes — v1.1.0: DealerBranchScope Platform Standard

Companion documents: `CHANGELOG_DEALERBRANCHSCOPE.md` (detailed
feature-by-feature summary), `docs/releases/MASP_PLATFORM_FOUNDATION_V1.1.md`
(full release record — architecture, verification, breaking changes,
known limitations, rollback plan), `src/lib/dealerBranchScope.ts` (the
implementation itself).

## Major changes

- **One authorization implementation**: every module's dealer/branch
  scoping and authorization now goes through
  `src/lib/dealerBranchScope.ts` (`resolveDealerScope`/
  `resolveBranchScope`/`assertBranchAccess`/`canAccessDealerBranch`) and
  `applyScope()` in `src/lib/db.ts` — never a module-specific
  reimplementation. Enforced by convention and confirmed by a repository-
  wide sweep at release time (zero duplicated `seesAllDealers(role) ?
  requested : session.dealerId` patterns remain outside the shared
  resolver).
- **DealerUser visibility changed**: from "records I personally created"
  to "every record in my own branch" (`seesOwnRecordsOnly` removed).
  This is the release's one breaking change — see the full release
  record for detail.
- **Shared client hook + component**: `useDealerBranchScope()` /
  `<DealerBranchSelector>` (`src/components/shared/scope/`) replace five
  independently hand-rolled dealer/branch filter implementations across
  Dashboard, NTR, PM, Records, and the three create-flow search dialogs.
- **Real security/data-integrity gaps closed**, not just refactored: an
  unscoped `GET /api/pm-records`, two Machine360 utilities filtering on
  a legacy free-text field instead of the real branch ID, MQR's create
  path not validating a DealerUser's own branch, and NTR Historical
  Import never validating `branch_id` at all.

## Verification

453/453 tests (up from 413/413), lint/typecheck/build clean, architecture
check 5/5, live Preview UAT with real create/edit/delete/upload calls
across SuperAdmin/DealerAdmin/two DealerUsers in different branches of
the same dealer.

## Upgrade notes

No destructive migration. `users.branch_id` is additive/nullable — an
existing `DealerUser` account without `branch_id` set will see zero
records post-upgrade (fail-closed) until an admin assigns their branch.
