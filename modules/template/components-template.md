# Template: components

Convention for deciding whether a component belongs to a module or to
`shared/`.

## The rule (from `.claude/rules/01-architecture-boundaries.md`)

New UI does not get added to `shared/components/` "just in case." It goes
there only when at least two modules genuinely need it — or, like
`calcWarranty()`, a second module's need is already known and planned.
Everything else starts in `modules/<name>/components/`.

## Practical guide

| Component is... | Lives in |
|---|---|
| A KPI card, chart wrapper, or generic data table used the same way everywhere | `shared/components/ui` (e.g. `KpiCard`, `Panel`, a generic `AdminCrudTable` — see `docs/ROADMAP.md` Sprint 3 (proposed)) |
| The app shell — sidebar, header, TH/EN toggle | `shared/components/layout` |
| A form, table, or detail view specific to this module's own resources (e.g. a PDI checklist form) | `modules/<name>/components/` |
| A component that started module-local but a second module now needs verbatim | Promote to `shared/components/`, update both call sites — don't fork it |

## Styling

Continues the existing Tailwind convention (`tailwind.config.ts` brand
tokens — gradients, shadows) and SweetAlert2 for all feedback. A module
does not introduce a second component library or a second notification
mechanism.

## What this template does not cover

Whether a module needs client-side state beyond `useState`/`useEffect` —
the codebase has no shared state library today (see `docs/ARCHITECTURE.md`
§6), and introducing one is an architecture decision, not a per-module one.
