# shared/admin/

Documentation-only output of Sprint 4 ("Admin Framework"). This folder
contains no code. It exists to record the design for a future, generic
`AdminCrud` layer that could eventually replace the five hand-written admin
table modules (Dealers, Branches, Users, Technicians, Problem Codes)
without changing their behavior.

Nothing here is implemented yet, and nothing in this folder changes how
the admin pages currently work. The five admin modules under
`src/app/(app)/admin/` and `src/app/api/admin/` are untouched and remain
the production code path.

## Read this first

`docs/ADMIN_FRAMEWORK.md` is the full analysis — current architecture,
shared patterns found across all five modules, and the rationale behind
every guide in this folder. The five guides below break that analysis into
focused references:

- **CRUD_GUIDE.md** — the shared create/edit/save state machine every
  table component implements today, and the proposed `useAdminCrud` hook.
- **API_GUIDE.md** — the shared request/response contract every
  `route.ts` follows today, and conventions for new routes.
- **TABLE_GUIDE.md** — the shared table/row/inline-edit layout.
- **FORM_GUIDE.md** — the shared "create new record" form-card layout
  and field-type conventions.
- **PERMISSION_GUIDE.md** — how `src/lib/scope.ts` gates every module,
  and the one module (Users) that needs more than a role check.

## Why this exists

Five modules currently duplicate the same ~200-line table component with
different field names. `docs/ADMIN_FRAMEWORK.md` §9 recommends an order for
collapsing that duplication into a generic `<AdminCrud>` component — but
recommends it as a future sprint, not something authorized by this one.
This sprint's mandate was analysis and design only; see the Safety Rules
in the Sprint 4 brief.
