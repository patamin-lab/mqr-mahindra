# Changelog — DealerBranchScope Platform Standard

Human-readable summary of the Dealer/Branch Scope Platform Standard
rollout that shipped as v1.1.0. See
`docs/releases/MASP_PLATFORM_FOUNDATION_V1.1.md` for the full release
record and `src/lib/dealerBranchScope.ts` for the implementation itself.

## Authorization model

Replaces the previous dealer-only, own-record-only model with one shared
standard used identically by every module:

- **SuperAdmin** / **CentralAdmin** — every dealer, every branch.
- **DealerAdmin** — every branch inside their own dealer.
- **DealerUser** — every record inside their own assigned branch (a
  service branch is a team, not an individual — replaces the old
  `seesOwnRecordsOnly` "records I created" rule, now fully removed from
  `scope.ts`).

Server side: `resolveDealerScope()`, `resolveBranchScope()`,
`assertBranchAccess()`, `canAccessDealerBranch()`
(`src/lib/dealerBranchScope.ts`), consumed by `applyScope()`
(`src/lib/db.ts`) for query-level filtering and by a route-level
`isOutOfScope()` check for single-record detail/mutate paths
(defense-in-depth — both layers independently enforce the same rule).
Client side: `useDealerBranchScope()` hook +
`<DealerBranchSelector>` component (`src/components/shared/scope/`),
replacing five independently hand-rolled dealer/branch filter
implementations.

## Modules migrated

Dashboard → NTR → PM → QIR/MQR → Machine360 → Reports (audited, no gap
found) → Export (audited, no gap found) → Historical Import → shared
search dialogs (`ntr-search.tsx`/`maintenance-search.tsx`/
`report-form.tsx`) → remaining APIs (admin branches/technicians/users
CRUD, `platform/events`, `technicians` lookup).

## Real gaps found and fixed

- NTR/PM's Machine360 "fetch-for-serial" utilities filtered on the
  legacy free-text `session.branch` string instead of the real
  `branchId` UUID — silently broken, matched nothing.
- `GET /api/pm-records` was completely unscoped — returned every
  dealer's PM records to any authenticated user regardless of role.
- MQR's `createRecord()` validated a submitted `branch_id` only against
  the resolved dealer, never against the DealerUser's own specific
  branch — allowed a DealerUser to tag a record to a sibling branch.
- NTR Historical Import validated `dealer_id` per row but never
  `branch_id` — allowed a cross-dealer `branch_id` to silently land in
  an imported record.
- Several admin master-data routes and `platform/events` duplicated the
  `seesAllDealers(role) ? requested : session.dealerId` ternary inline
  instead of using the shared resolver — consolidated, zero behavior
  change for any role.

## Session/JWT

`SessionUser` gains `branchId: string | null` (the real `branches.id`),
set from a new `users.branch_id` column at login. The pre-existing
`branch` free-text field is unchanged and remains display-only, never
used for scoping.

## Deliberate design decisions

- Vehicles (Machine360's master-data entity) remain **dealer-scoped,
  not branch-restricted** — `vehicles.branch_id` is often null (external
  Tractor-IN sheet sync), and further restriction would break legitimate
  cross-branch vehicle lookup.
- `vehicle_events` has no `dealer_id`/`branch_id` column, so a
  DealerUser may see a generic timeline entry (date/title only, no PII)
  for a sibling-branch event; clicking through to the full record is
  independently blocked by that record's own branch check.

## Verification

453/453 tests passing (up from 413/413 at v1.0.0 — +40 new tests for
DealerBranchScope's resolver functions and each migrated module's
branch-scoping behavior), `tsc --noEmit` clean, lint 0 errors, `next
build` succeeds, `npm run architecture` 5/5 PASS, live Preview UAT
across SuperAdmin/DealerAdmin/two DealerUsers in different branches of
the same dealer.
