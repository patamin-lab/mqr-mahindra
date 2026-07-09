# v2.3.1 — Tractor IN Sync Hardening: Production Rollout Plan

Companion to PR #25 and `docs/adr/ADR-012-Tractor-IN-Master-Data.md`'s
"v2.3.1: Sync Hardening" section. This document is the operational plan
for the **first production execution** of the insert-capable
`TractorInSyncService` — the code merges with this plan, but the real
(non-dry-run) sync itself stays a deliberate, separately-triggered manual
action, not something automatically run at deploy time.

## 1. Dry-run (completed pre-merge, read-only, zero data modified)

Executed live against the production Supabase project (via a Preview
deployment pointing at the same database — this repo has no separate
staging DB) using `POST /api/admin/tractor-in/sync?dryRun=true`.

| Metric | Value |
|---|---|
| Total sheet rows | 330 |
| Would insert | 0 |
| Would update | 330 |
| Would skip | 0 |
| Would fail | 0 (dry run can't predict runtime failures — see note below) |
| Duration | 1,273 ms |

**Why 0 inserts**: every one of the sheet's 330 real serials already has a
matching `vehicles` row (verified independently via direct SQL during the
v2.3.0 review — see ADR-012). The real run is expected to be an
update-only metadata pass (stamping `last_synced_at`/`sync_source` on all
330 matched vehicles) — no new rows, no Product Family/Sub Model changes
either, since the sheet's own `Product Family`/`Sub Model` columns are
still empty sheet-wide (the manual sheet-owner prerequisite from ADR-012
hasn't happened yet).

**Verified no data was modified by the dry run**:
- `GET /api/admin/tractor-in/health` before and after: identical
  (`lastSyncTime: null`, `syncStatus: "never_run"`).
- Direct SQL: `tractor_in_sync_runs` has 0 rows, `vehicles.last_synced_at`
  is non-null for 0 rows, `vehicles` total still 333, 0 duplicate serials.

**Dry-run limitation, stated plainly**: because no write is attempted, a
dry run's `failed` count is always 0 — it reports the *planned* action
per row from current data shape, not runtime failures (a network blip or
constraint violation can only surface during a real write). The real run
could still report `failed > 0` even though the dry run reported 0 — this
is expected and handled (see §3, §4).

## 2. Production execution (rollout checklist)

Run this **after** this PR is merged and deployed to production — not
automatically, not in this session. Whoever runs it (an operator with
SuperAdmin access) should follow this checklist in order:

- [ ] Confirm the merge commit is deployed to production (`GET /login`
      returns 200; check the GitHub Deployments tab or Vercel dashboard
      for a `Ready`/production state on the merge commit's SHA).
- [ ] Call `GET /api/admin/tractor-in/health` once — confirm
      `syncStatus: "never_run"` and note `totalVehicles` (expected: 333,
      unless other work has changed it since this plan was written).
- [ ] Call `POST /api/admin/tractor-in/sync` (no `dryRun` param — this is
      the real, writing execution).
- [ ] **Capture the full response immediately**: `inserted`, `updated`,
      `skipped`, `failed`, `durationMs`. Save it (paste into the PR, a
      ticket, or this document) — it's the baseline every check in §3
      compares against.
- [ ] Call `GET /api/admin/tractor-in/health` again, immediately after.
      Confirm it now reports `syncStatus` matching the sync response
      (`"success"` if `failed === 0`, `"partial_failure"` otherwise), and
      that `inserted`/`updated`/`failed` match the sync response exactly.

## 3. Post-sync verification checklist

Run every check below against the same production database, immediately
after §2. All are read-only.

- [ ] **No duplicate Serial Numbers**:
      `select serial, count(*) from vehicles group by serial having count(*) > 1;`
      → must return 0 rows. (Structurally guaranteed by
      `vehicles_serial_key` plus the service's own in-memory dedup — this
      check confirms it, doesn't just trust it.)
- [ ] **Vehicle count increased only by the reported INSERT count**:
      `select count(*) from vehicles;` → must equal
      `(vehicle count from §2's pre-sync health call) + inserted` from
      the sync response.
- [ ] **Existing vehicles were updated correctly**: spot-check a handful
      of serials that existed before the sync —
      `select serial, last_synced_at, sync_source, product_family_id, sub_model from vehicles where serial in (...);`
      → `last_synced_at` should be at/after the sync's `started_at`,
      `sync_source = 'tractor_in_sheet'`.
- [ ] **Product Family mappings remain valid** (no orphan FK):
      `select count(*) from vehicles v left join product_families pf on pf.id = v.product_family_id where v.product_family_id is not null and pf.id is null;`
      → must be 0.
- [ ] **No orphan records** — dealer references on any newly-inserted row:
      `select count(*) from vehicles v left join dealers d on d.id = v.dealer_id where v.dealer_id is not null and d.id is null;`
      → must be 0.
- [ ] **Sub Model still NULL where the sheet has no value**:
      `select count(*) from vehicles where sub_model is not null;` →
      expected 0 until the sheet's own Sub Model column is populated (see
      §1 — this run isn't expected to change this number; if it's
      non-zero, the sheet owner has since added real data, which is fine,
      just confirm it lines up with what the sheet actually shows for the
      affected serials).
- [ ] **Sync log matches the actual database state**: the most recent
      `tractor_in_sync_runs` row's `inserted`/`updated`/`failed` must
      equal the counts independently confirmed above — if the sheet
      itself changes between the dry run and the real run (someone edits
      it), the log is still the source of truth for what *that specific
      run* did, not the dry run's numbers.

If every box above is checked and matches, the rollout is confirmed
successful — no further action needed until the sheet owner adds the
Product Family/Sub Model columns (see ADR-012), at which point re-running
the sync will start populating real values instead of just metadata.

## 4. Rollback (if unexpected INSERT behavior occurs)

Trigger this checklist if the real run's numbers don't match the dry
run's expectations in a way that suggests a real problem — e.g.
`inserted` is unexpectedly large, `failed` is non-zero for reasons that
don't look like transient network errors, or any check in §3 fails.

- [ ] **Stop additional sync executions immediately.** Do not re-run
      `POST /api/admin/tractor-in/sync` to "see if it clears up" — that
      risks compounding whatever went wrong. The service is idempotent by
      design, but idempotency doesn't help if the *input* (the sheet) or
      the *logic* is the actual problem.
- [ ] **Isolate what actually changed** before touching anything: query
      `tractor_in_sync_runs`' `failures`/`unmatched_product_family`
      columns for the run in question, and diff `vehicles` rows touched
      in that run (`last_synced_at` at/after the run's `started_at`)
      against their pre-sync state if a snapshot was taken (see §2 — this
      is why capturing the pre-sync health/count matters).
- [ ] **Restore from backup if necessary.** This project uses Supabase's
      standard project backups (see `docs/06_DEPLOYMENT/SUPABASE.md`) —
      restoring is a last resort for confirmed bad writes that can't be
      corrected with a targeted `UPDATE`/`DELETE`, since it rolls back
      *everything* in the project to the backup point, not just
      `vehicles`. Prefer a targeted fix (e.g., the same
      `UPDATE vehicles SET sub_model = NULL WHERE ...` pattern used to
      revert the v2.3.0 column-mapping incident — see ADR-012) whenever
      the bad state is precisely identifiable from the run log.
- [ ] **Document root cause before re-running anything.** Add a
      "Correction" section to ADR-012 (matching the existing precedent
      from the v2.3.0 column-mapping incident) describing what happened,
      how it was caught, and the exact remediation — before attempting
      the sync again. Re-running blind, without understanding why the
      first run misbehaved, is how the same mistake repeats.

## 5. Monitoring checklist (ongoing, after a successful rollout)

- [ ] Bookmark `GET /api/admin/tractor-in/health` as the first place to
      check "did the last sync work" — no direct Supabase query needed
      for a routine check.
- [ ] After each future sync run (manual today; scheduled once a
      scheduler platform exists — see ADR-012), re-check `syncStatus` —
      treat `"partial_failure"` as worth investigating (check
      `failures` in the corresponding `tractor_in_sync_runs` row) even
      though it doesn't block anything automatically.
- [ ] Revisit PM's `getProductFamilyIdForModel()` fallback (see
      `maintenanceSummaryProvider.ts`'s code comment and ADR-012) once
      `select count(*) from vehicles where product_family_id is null;`
      reaches 0 (or the remaining nulls are confirmed genuinely
      out-of-fleet) — that's the exact, checkable condition for removing
      it.
