# ADR-012: Tractor IN as the Single Source of Truth for Product Family / Sub Model

## Problem

The NTR registration form let a dealer manually pick Product Family and
type/select a Sub Model, sourced from `product_family_models` (a
model→family mapping table) and NTR's own historical `variant` values
respectively. This meant:

- Product Family was re-derived from `vehicles.model` on every read
  (`getProductFamilyIdForModel()`), independently in NTR and PM, rather
  than being a stored, synced fact about the vehicle.
- Sub Model had no real master-data source at all - it was whatever a
  dealer had typed into a prior NTR record.

Both are properties of the physical tractor, not something a dealer
should choose at registration time - they should come from the Tractor
IN Google Sheet (the warehouse intake master list), the same way
model/engine number already do.

## Decision

1. **`vehicles.product_family_id` / `vehicles.sub_model`** (new, nullable
   columns) become the read model every business module (NTR, PM) reads
   from. Neither is ever written by a business module.
2. **`TractorInSyncService`** (`src/features/vehicle/services/
   tractorInSyncService.ts`) is the *only* place that writes these two
   columns. It reads the Tractor IN sheet's `Product Family`/`Sub Model`
   columns (a manual prerequisite - see below), resolves Product Family
   by exact `code`/`name` match against `product_families` (never
   guesses, never auto-creates), and upserts into `vehicles` by serial.
3. **No read-through sync.** NTR's tractor search and PM's vehicle lookup
   never trigger a sync as a side effect of a lookup - they only read
   whatever is already in `vehicles`. Synchronization is a deliberate,
   separate action.
4. **Manual trigger today.** `POST /api/admin/tractor-in/sync`
   (SuperAdmin-only) is the sync's one entry point. No scheduler platform
   exists in this repo yet (see `docs/architecture/PLATFORM_CONSTITUTION.md`'s
   Platform service boundaries section) - a scheduled trigger can be
   added later by calling the same `TractorInSyncService.sync()`, with no
   change to the service itself.
5. **PM's temporary fallback.** `maintenanceSummaryProvider.ts` prefers
   `vehicle.product_family_id`; only falls back to the old
   `getProductFamilyIdForModel()` derivation for a vehicle not yet
   synced. Marked with a `TODO(tractor-in-sync)` for removal once the
   first production sync has run.
6. **Legacy Import unchanged.** It reads `product_family_id`/`variant`
   directly from the uploaded historical file's own columns - a
   completely separate, unaffected path.

## Manual prerequisite (outside this codebase)

This codebase has no write access to the Tractor IN Google Sheet (it's
read via the sheet's public CSV export URL - see `lib/tractorSheet.ts`).

**Correction (2026-07-09):** this ADR originally proposed adding the new
columns at position 8/9, based on `lib/tractorSheet.ts`'s own doc
comment, which turned out to be stale - it documented only 7 columns.
Fetching the live sheet's actual CSV directly during verification showed
it already has **9** real columns, the last two being `วันที่ส่งมอบ`
(Delivery Date, Thai) and `Dealer` - neither previously known to this
codebase. A first sync attempt against the live sheet before this
correction briefly wrote the `Dealer` column's value (`"KTV"`) into
`vehicles.sub_model` for 12 rows; caught immediately via the sync's own
result reporting (12 rows "updated" against a sheet with no real Product
Family/Sub Model data yet was the tell), and reverted with `UPDATE
vehicles SET sub_model = NULL WHERE sub_model = 'KTV'` before any other
module read it. No `product_family_id` was affected. **The sheet owner
must add two columns**, in this exact position (columns 10 and 11,
immediately after the existing `Dealer`):

| Column | Notes |
|---|---|
| `Product Family` | Must exactly match an existing `product_families.code` or `.name` (case-insensitive) - a row whose text doesn't match anything real is reported as "unmatched" by the sync, not guessed |
| `Sub Model` | Free text |

Until this column exists, `TractorInSyncService.sync()` simply finds
nothing to write for any row (both fields read as empty string) - it
does not error. Verified live against the real sheet post-fix: 0 rows
updated, 0 unmatched (confirms the fix; see Verification section).

## Database migration

```sql
alter table vehicles add column product_family_id uuid references product_families(id);
alter table vehicles add column sub_model text;
create index vehicles_product_family_id_idx on vehicles(product_family_id);

-- Backfill product_family_id for existing vehicles from the
-- already-correct model -> family mapping. sub_model stays NULL - no
-- source of truth for it exists until the sheet has the new column.
update vehicles v
set product_family_id = pfm.product_family_id
from product_family_models pfm
where pfm.model = v.model
  and v.product_family_id is null;
```

Applied 2026-07-09 as Supabase migration
`add_vehicles_product_family_and_sub_model`. Result: 290/333 existing
vehicles backfilled with `product_family_id` (the remainder have a
`model` with no entry in `product_family_models` - expected, not an
error); 0/333 have `sub_model` (expected - no source exists yet).

## Rollback plan

The migration is additive only (two new nullable columns, one index, one
backfill `UPDATE` against columns that didn't previously exist) - nothing
existing is modified or dropped. To roll back:

```sql
drop index if exists vehicles_product_family_id_idx;
alter table vehicles drop column if exists product_family_id;
alter table vehicles drop column if exists sub_model;
```

Application-level rollback: revert the NTR/PM code changes in this PR.
`maintenanceSummaryProvider.ts`'s fallback to `getProductFamilyIdForModel()`
means PM keeps working identically even mid-rollback (it was already
resilient to `vehicle.product_family_id` being absent/null before this
column existed). NTR's manual form would need `product_family_id`/
`sub_model` reintroduced as user-editable fields if fully reverted - the
prior PR (#21/#23) history has that shape if ever needed again.

No data loss risk: `product_family_id`/`sub_model` are the only new
columns, nothing else changes, and `ntr_records`/Legacy Import are
completely unaffected regardless of rollback.

## Known limitation: sync updates existing vehicles, never creates new ones

`TractorInSyncService.sync()` only ever calls `.update().eq('serial', ...)`
against `vehicles` - it never inserts. A Tractor IN sheet row whose serial
has no matching `vehicles` row is silently skipped (not counted, not
reported as unmatched). This matches this ADR's approved scope exactly
("the sync service updates the vehicles table") - creating new `vehicles`
rows stays the job of the pre-existing, unchanged path (NTR's "Create
Tractor" flow, used when a dealer selects a serial with no match).

Verified live (2026-07-09): every one of the sheet's 330 real serials
already has a matching `vehicles` row (333 total - 3 extra vehicles exist
that aren't in the sheet, created via the manual flow) - so this
limitation has zero current data impact. It becomes relevant only if a
brand-new tractor is added to the sheet before any dealer has created its
`vehicles` row - that row's Product Family/Sub Model would never sync
until it exists. Tracked as technical debt, not a release blocker; revisit
if/when the sheet becomes the sole path for onboarding a new serial.

## Consequences

- Product Family is now a stored, synced fact per vehicle instead of
  re-derived per read - NTR and PM read the identical value, with PM's
  fallback existing only as a temporary migration safeguard.
- Sub Model has a real, single source of truth (Tractor IN) instead of a
  dealer-typed value with no master data behind it - at the cost of a
  manual, one-time sheet-schema change and a still-manual sync trigger
  until a scheduler exists.
- `/api/ntr/variants` and its backing repository/service methods are
  removed - Sub Model is never chosen manually in NTR again.
