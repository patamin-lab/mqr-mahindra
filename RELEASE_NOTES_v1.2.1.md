# Release Notes — v1.2.1: MASP Address Platform (Supabase Canonical Tables)

**Status: RELEASED.** Tagged and published as GitHub Release `v1.2.1` on
merge commit `c45c3ab584b0709e87cbdcd2fd98940aa3bfd0c0` (PR #18), on top
of PR #16 (`b351b424c2d3fa62d9b693dd8192fdb7ed19d54b`) - both merged
2026-07-08. See `PROJECT_STATE.md`'s "Address Platform Migration" entry
for the full merge/tag/release/production verification record, and
`docs/adr/ADR-011-Address-Platform.md`'s v2 Supersession section for the
decision record.

## Summary

Thailand Address Master Data has been imported into Supabase, superseding
v1.2.0's in-memory-JSON-backed Address Platform. Before building on top
of the imported tables, an audit found they were a raw, undeduplicated
flat export (`provinces`/`districts` had 7,436 rows each for only
77/928 distinct ids, zero primary keys/foreign keys/indexes anywhere) -
confirmed with the project owner before writing any migration, given
this was a real Database Integrity finding, not a rubber-stamp of
"the data exists now."

## What changed

- **Canonical tables**: `provinces` (77 rows) / `districts` (928 rows) /
  `subdistricts` (7,436 rows) - deduplicated, with primary keys, foreign
  keys, and the three required indexes (`districts.province_id`,
  `subdistricts.district_id`, `subdistricts.postcode`). RLS enabled with
  a permissive `SELECT` policy, matching the existing pattern for other
  reference tables.
- **Raw import preserved**: `provinces_raw`/`districts_raw`/
  `subdistricts_raw` - untouched, immutable, kept as seed/backup data.
- **`AddressRepository`** (new): the one Supabase-backed data-access
  layer for address reference data, with an instance-level cache per
  method.
- **`MasterDataService`'s Address Platform methods are now `async`**,
  backed by `AddressRepository` instead of a static JSON index. Every
  call site (`/api/master/*` routes, NTR's Historical Import validation)
  updated to `await` them.
- Pre-v2 JSON module moved to `shared/master-data/address/seed/` - kept
  only as seed/backup/test-fixture data; no production code path imports
  it.

## Data quality (migration summary)

| | Raw rows | Canonical rows | Duplicates removed | Invalid rows rejected |
|---|---|---|---|---|
| Provinces | 7,436 | 77 | 7,359 | 0 |
| Districts | 7,436 | 928 | 6,508 | 0 |
| Subdistricts | 7,436 | 7,436 | 0 | 0 |

## Verification

lint / typecheck / 487 tests (+12 new) / build / architecture-check all
pass. Live UAT on a Vercel Preview: all three `/api/master/*` routes
verified against real canonical data, Historical Import preview
correctly accepted a valid row and rejected a cross-province mismatch
(the exact "District X does not belong to Province Y" case), full
regression sweep across Dashboard/NTR/PM/Records/Vehicles/Dealer admin
found no regression. CI on `main` green post-merge; production
re-confirmed healthy (`https://masp-mseal.vercel.app`, 200 on `/login`,
77 provinces served live from the canonical table).

## Breaking changes

None to any other module's data or API contracts. `/api/master/*`'s
request/response shape is unchanged from v1.2.0 - only the underlying
data source moved from a static JSON file to Supabase.

## Upgrade notes

No destructive migration - the raw imported tables were renamed
(`provinces`/`districts`/`subdistricts` → `*_raw`), not dropped, and the
new canonical tables are additive. `ntr_records` is unchanged - customer
address fields still store Thai names as free text, not foreign keys
(see the Roadmap note below).

## Deferred (roadmap)

Migrating customer address fields (`ntr_records.customer_province`/
`customer_district`/`customer_subdistrict`/`customer_postal_code`, or
any future module's equivalent) to resolved foreign keys against the
canonical Address Platform tables requires its own future ADR once a
real business requirement exists - see `docs/ROADMAP.md`.
