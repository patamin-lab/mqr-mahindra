# shared/ui

> Status as of Sprint 3 (Shared UI Inventory). **This folder is intentionally
> empty of components.** No code has been moved here yet, and no production
> import currently points at this folder. Do not move anything into it without
> a separate, explicitly-approved migration step — see the safety note below.

## What this is

The planned future home for UI components that are used (or clearly
reusable) across more than one module of the MSEAL SERVICE SYSTEM —
buttons, cards, charts, badges, form fields, tables, and similar. It exists
now purely so the inventory work in Sprint 3 has a named destination to
recommend components *toward*, without actually touching any existing code.

## What's here today

Just this README. Nothing else.

## Where the inventory and migration plan live

- `docs/SHARED_UI_ANALYSIS.md` — every reusable component/pattern found in
  the live codebase, scored for reusability, migration priority, and risk,
  plus a recommended migration order.
- `docs/COMPONENT_CATALOG.md` — a plain reference catalog of the same
  components, organized by category (Sidebar, Buttons, Cards, Tables, Forms,
  Charts, etc.).

## Planned subfolder layout (not created yet)

For when migrations actually start, the analysis docs above suggest grouping
by concern rather than by source page, e.g.:

```
shared/ui/
  feedback/     swal.ts wrapper, LoadingState
  layout/       Sidebar, LanguageToggle
  navigation/   NavLink
  buttons/      PrintButton, ConfirmDeleteButton
  cards/        KpiCard, Panel
  badges/       StatusBadge, SeverityBadge
  tables/       AdminCrudTable, EmptyState, Pagination
  forms/        SelectField, SerialAutocomplete
  charts/       MonthlyTrendChart, ParetoChart, StatusBarChart, SimpleBarChart, AgingBarChart
  maps/         LocationPicker, MapView
```

`fetchJson`, `exportExcel`, and the Google Drive upload relay are services,
not UI, and are recommended to live under `shared/services/` instead — see
`docs/SHARED_UI_ANALYSIS.md` for the full reasoning per item.

## Safety note

Per the Sprint 3 brief: no component should be moved into this folder, and
no existing import/route/business logic should change, without first
stopping to get explicit approval. The migration order in
`docs/SHARED_UI_ANALYSIS.md` §3 is a recommendation for *when that approval
is sought*, not authorization to proceed on its own.
