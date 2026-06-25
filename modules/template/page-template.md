# Template: pages

Convention for a module's pages, distilled from how every page under
today's `src/app/(app)/*` already works (see `docs/ARCHITECTURE.md` §2) —
new modules continue this pattern, they don't invent a new one.

## Pattern

1. **Server Component by default.** The page itself re-checks the session
   (`getSession()`-equivalent from `shared/auth` once extracted) and calls
   into the module's service layer (`service-template.md`) directly — no
   client-side fetch for the initial render.
2. **Scope, not just auth.** A session check alone is not enough; every
   list/detail query goes through `applyScope()` so a logged-in user only
   ever sees their own dealer/branch's rows. This is non-negotiable per
   `docs/ARCHITECTURE.md` §5.
3. **Client Components only for mutation.** Anything that changes data
   (create/update/delete/status-change) is a Client Component calling a
   same-origin `/api/...` route via `shared/fetchJson` — never a server
   action that skips the API layer's independent re-validation.
4. **Feedback is SweetAlert2, exclusively.** No inline banners, no toasts
   from another library. See `.claude/rules/04-ui-feedback-conventions.md`.
5. **Layout comes from the shared shell.** `shared/components/layout`
   (sidebar, header, TH/EN toggle) wraps every module page; a module does
   not build its own app shell.

## Folder location

Not decided here. `docs/MODULE_GUIDE.md` §2 explicitly defers this to the
Sprint that migrates MQR (`modules/mqr/pages/` vs. co-located Next.js route
groups) — this template will be updated once that decision is made, rather
than guessed at now.

## What this template does not cover

Routing/URL structure (see `docs/MODULE_ARCHITECTURE.md` §"Routing
conventions") and permission gating beyond the base scope check (see
`docs/MODULE_ARCHITECTURE.md` §"Permissions").
