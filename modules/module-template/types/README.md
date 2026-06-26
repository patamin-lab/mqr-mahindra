# types/

TypeScript types for this module's domain entities — the record shapes this module owns.

## Convention

- One file per entity group for any module with more than a couple of entities, e.g. `types/partsRequest.ts`; a single `types/index.ts` is acceptable for a small module. This folder is the directory form of the single `types.ts` file named in `docs/MODULE_ARCHITECTURE.md` §1 — use whichever granularity the module's own `README.md` documents.
- Types here describe this module's own tables/records only. A type shared across modules (e.g. a `Dealer` or `Branch` reference) is imported from wherever that entity's owning module or `shared/` defines it — never redeclared locally.
- Field naming mirrors the database's `snake_case` columns only at the data-access boundary (`services/`); once mapped into application code, follow ordinary TypeScript `camelCase` convention per `docs/NAMING_STANDARD.md`.

## Relationship to other docs

- `docs/MODULE_ARCHITECTURE.md` §1, §4 — the `types.ts` convention and the database naming this folder's shapes are derived from.
- `docs/NAMING_STANDARD.md` — naming conventions for types, fields, and the database-to-application-code mapping.

## Status

Empty. No module entity is defined yet.
