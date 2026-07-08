# ADR-011: Address Platform

## Problem

The MASP Platform Layer (v1.2.0, PR #14) shipped an Address Platform
(`src/shared/master-data/address/`) built around an in-memory JSON index
and `/api/address/*` routes (`provinceId`/`districtId` camelCase query
params). The subsequently-adopted **MASP Enterprise Development
Standard** describes a different concrete shape for the same platform:
DB tables (`provinces`/`districts`/`subdistricts`) and `/api/master/*`
routes with `province_id`/`district_id` snake_case params. Before
adopting that Standard as this repository's canonical architecture
document, the conflict needs a decision - not a silent pick of whichever
document was written more recently.

## Audit: implementation vs. Standard

| Requirement (Standard) | Current implementation | Verdict |
|---|---|---|
| Shared Tables: `provinces`/`districts`/`subdistricts` | In-memory index built once per serverless instance from `data/thaiAddressMaster.json` (7,436 rows, one-time export of the reference spreadsheet) | **Mismatch** - see Decision |
| Shared APIs: `/api/master/provinces`, `/api/master/districts?province_id=`, `/api/master/subdistricts?district_id=` | Was `/api/address/*` with `provinceId`/`districtId` | **Reconciled this ADR** - renamed to match |
| Shared Component: `AddressSelector` | Exists, same name, same cascading shape | Match |
| Province → District → Subdistrict → Postal Code (auto-fill) | Implemented - postal code auto-fills when a subdistrict has exactly one valid code | Match |
| Searchable Dropdown | Was a plain `<select>` with no filtering | **Reconciled this ADR** - added a filter `<input>` per level, narrowing the `<select>`'s options as the user types |
| Keyboard Accessible | Native `<select>`/`<input>` - accessible by default | Match |
| Cached | Server: module-level singleton index, built once per instance. Client: per-selection `Map` cache in `AddressSelector`, mirroring `useDealerBranchScope`'s branch cache | Match |
| Thai Support | Full Thai province/district/subdistrict names, `normalizeThaiAddressValue()` strips administrative prefixes for matching | Match |
| Reject invalid Province/District/Subdistrict combinations | `validateThaiAddress()` (Historical Import path) + the cascading `<select>`'s own structure (a child list is only ever populated with children of the selected parent, so an invalid combination cannot be constructed in the interactive form) | Match |
| Auto-clear child selections | Implemented - changing Province clears District/Subdistrict/Postal Code; changing District clears Subdistrict/Postal Code | Match |
| Historical Import: accept Thai names, resolve to `province_id`/`district_id`/`subdistrict_id`/`postcode` | Import validates the name hierarchy (`validateThaiAddress`) but `ntr_records` stores the Thai names as free text (`customer_province`/`customer_district`/`customer_subdistrict`/`customer_postal_code`), not resolved foreign-key IDs | **Mismatch** - see Decision |

## Decision

**Keep the in-memory JSON design; do not migrate to DB tables or add ID
foreign keys.** Reconcile only the two safe, mechanical gaps (API route
naming, searchable dropdown) and document the rest as an intentional,
justified deviation from the Standard's literal wording.

Reasoning, against this repository's own "Architecture Evolution Rule"
(a platform layer changes only when a real business module needs it, the
change measurably reduces maintenance cost, and is backed by an ADR - not
"just in case"):

1. **No consumer needs ID-based foreign keys today.** Every current
   caller (NTR's registration form, NTR's Historical Import) only ever
   needs to validate and display a Province/District/Subdistrict name -
   never to join against a `province_id` column elsewhere. Adding tables
   and foreign keys with zero real consumer would be exactly the
   "infrastructure add just in case" this repository's own rule warns
   against.
2. **The data is a static reference dataset, not business data.**
   Thailand's province/district/subdistrict list changes on the order of
   years, not days (the source doc itself calls regenerating it "a
   manual, explicit step"). A `provinces`/`districts`/`subdistricts`
   table would need to be seeded from the exact same JSON export this ADR
   would otherwise keep using directly - the DB tables would just be a
   slower, migration-risk-carrying copy of the same 7,436 rows, not a new
   capability.
3. **A DB migration here is a real production-data risk for zero measured
   benefit.** This repository's Database Standard requires migrations to
   be justified, backward-compatible, and rollback-considered - "the new
   Standard document says so" is not a measured performance or business
   justification, and the Foundation Freeze explicitly restricts
   non-bugfix/non-security/non-performance changes to a completed
   platform layer without one.
4. **The in-memory design already satisfies every *behavioral*
   requirement** (cascading, auto-clear, postal auto-fill, hierarchy
   validation, Thai support, caching, keyboard access) - the Standard's
   "Shared Tables" wording describes one possible *storage* mechanism to
   deliver that behavior, not a requirement in itself.

What **is** reconciled in this ADR (both are safe, additive, zero
production-data-risk changes):

- **API route naming**: `/api/address/*` → `/api/master/*`,
  `provinceId`/`districtId` → `province_id`/`district_id` - a pure
  rename with exactly two call sites (`AddressSelector.tsx`, one doc
  comment in `ntr-search.tsx`), no data migration, no behavior change.
- **Searchable Dropdown**: added a plain-text filter `<input>` above each
  of the three `<select>` elements in `AddressSelector`, narrowing the
  `<select>`'s own option list as the user types. Deliberately not a
  free-text `<input list>`/combobox - that would allow typing a value
  that isn't a real option, undermining "reject invalid combinations."
  No new dependency (this repo's binding rule against adding one
  casually).

## Alternatives Considered

- **Migrate to DB tables + foreign keys, fully matching the Standard's
  literal wording** - rejected per the Decision above: no consumer need,
  real migration risk, and a direct violation of this repository's own
  Architecture Evolution Rule and Foundation Freeze if attempted without
  a demonstrated business need.
- **Leave the route names as `/api/address/*` and treat the Standard's
  `/api/master/*` wording as non-binding** - rejected: the rename is
  zero-risk and costs nothing, so there is no reason to leave a known,
  documented mismatch against the now-canonical Standard when reconciling
  it is this cheap.
- **A full searchable combobox (type digital match against any position,
  ARIA combobox pattern, keyboard-navigable listbox)** - rejected as
  over-engineering for what a native `<select>` plus a filter input
  already delivers; revisit only if real usage shows the filter-input
  pattern is insufficient.

## Consequences

- `AddressSelector` and its three backing routes now match the Standard's
  naming exactly; a future reader comparing code to the Standard document
  will find them consistent.
- The Standard's "Shared Tables" and "resolve `province_id`/`district_id`/
  `subdistrict_id`/`postcode`" wording is explicitly superseded by this
  ADR for the Address Platform specifically - a future module that
  genuinely needs a real foreign-key reference to a subdistrict (not just
  display/validation) is a new, real business need that gets its own ADR
  at that time, not a retroactive trigger to redo this one.
- `docs/architecture/PLATFORM_CONSTITUTION.md`'s Master data rules section
  and `PROJECT_STATE.md` are updated to point here rather than restate
  the reconciliation inline.
