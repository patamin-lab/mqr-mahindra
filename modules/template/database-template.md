# Template: database

Convention for a module's Supabase tables, matching every existing table
in the current schema (see root `CLAUDE.md`).

## Two-layer isolation (must replicate both, not just one)

1. **Postgres RLS** enabled on the table, scoped by dealer/branch.
2. **`applyScope()`** in the module's service layer (`service-template.md`)
   adds the same filter again in application code.

Neither layer is trusted alone — this is restated from
`docs/ARCHITECTURE.md` §5 because it is the single most important
non-negotiable rule for any new table in any new module.

## Soft delete

Tables get `record_status`, `deleted_by`, `deleted_at` columns, matching
the existing pattern. Hard delete is reserved for the `users` table and
`SuperAdmin` only — a new module's tables don't introduce a second hard-delete
path without an explicit decision to do so.

## Naming

- Table names: `snake_case`, no module prefix in the table name itself
  (the module boundary lives in code organization, not in SQL naming) —
  matches existing tables (`mqr_records`, `dealers`, `parts`, …).
- Column names: `snake_case`, matching Postgres convention already in use.
- Foreign keys reference existing master tables (`dealers`, `branches`,
  `technicians`) where applicable rather than duplicating that data.

## Migrations

Schema changes go through the Supabase MCP migration tooling already
available in this environment (`apply_migration`), not hand-run SQL outside
of source control. No migration is applied as part of writing this
template — this document only describes the convention for when a real
module's tables are created.

## What this template does not cover

Whether a module needs new tables at all, or can model its data as columns
on an existing table — that is a per-module design decision made when the
module is actually built, not assumed here.
