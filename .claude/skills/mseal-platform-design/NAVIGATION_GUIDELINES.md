# Navigation Guidelines

Single source of truth: `src/app/(app)/navConfig.ts`'s `getNavGroups()`,
consumed by both `Sidebar` (rendering) and `PlatformHeader`
(breadcrumb/title lookup via `flattenRealNavItems()`). Never add a nav
entry inline in a component - always through `navConfig.ts`.

## Taxonomy

Group -> Item, optionally -> Subgroup (one level of nesting, never
deeper). Current groups: Dashboard, Machines, Service, Quality,
Engineering Intelligence, Reports, Administration - see
`docs/architecture/MSEAL_DESIGN_FRAMEWORK.md` §2 for the full table.

## Coming Soon convention

A leaf with no real route is `{ href: null, comingSoon: true, label }`,
rendered disabled with a "Coming Soon" badge - never a link to a
placeholder page, never silently omitted. Use the `comingSoon()` helper
in `navConfig.ts` rather than constructing the object by hand.

## Role visibility

Nav visibility mirrors (but never replaces) server-side enforcement -
every route re-checks its own `lib/scope.ts` predicate regardless of
whether the nav shows it. A group with zero visible items for the current
role is omitted entirely (see `getNavGroups()`'s Administration-group
logic) rather than rendered empty.

## Adding a new nav entry

1. Real route exists and is permission-checked server-side -> add as a
   real item with its route's gating predicate.
2. No route yet, module planned -> add as Coming Soon in the group where
   it belongs per the Target Navigation, not omitted.
3. Never invent a new top-level group without checking
   `docs/architecture/MSEAL_DESIGN_FRAMEWORK.md` §2 first - most new
   items belong under an existing group.

## Known open item

PDI and Parts Request have no nav entry (real or Coming Soon) today - see
`docs/architecture/MSEAL_DESIGN_FRAMEWORK.md` §2/§7. Don't silently add or
silently continue omitting them - it's a named, open product decision.

## Domain ownership (pre-merge refinement, ADR-023 addendum)

- **Engineering Intelligence owns PIP.** PIP is produced from Quality
  Cases/Knowledge but is an Engineering deliverable - it has exactly one
  nav entry, under Engineering Intelligence (alongside Knowledge Engine,
  Troubleshooting, AI Analysis, Prediction, Insights), never a second copy
  under Quality. Quality's own group comment states it produces Cases a
  PIP is built from but does not own the PIP page. (Service > Campaigns'
  separate, unchanged PIP entry represents a different relationship -
  Service tracking a PIP as a campaign, not a duplicate page - see
  `docs/architecture/MSEAL_DESIGN_FRAMEWORK.md` §2a.)
- **Troubleshooting** (Engineering Intelligence, Coming Soon) is
  architecture-reserved only - future AI-assisted troubleshooting,
  knowledge-guided diagnostics, failure trees, decision trees, repair
  procedures. No functionality.
- **Reports is cross-cutting, not a domain** - it consumes data from every
  domain group above it, owns none of its own. It gets a nav group for the
  same reason Administration does, not because it's a domain like
  Machines/Service/Quality (§2b in the framework doc).
