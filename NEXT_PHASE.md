# Next Phase — Phase 6 Recommendation (Planning Only)

No implementation performed or implied by this document - a
recommendation for the next explicit body of work, to be approved and
scheduled separately, one milestone at a time, the same way every
milestone in this platform's build-out was. See `TECHNICAL_DEBT.md` for
the confirmed findings this plan is built from.

## Recommended branch

`feature/phase-6-platform-hardening` - a tracking branch for the
lower-risk hardening milestones (1-3 below); the higher-risk/larger
items (4-7) each warrant their own dedicated branch
(`feature/vehicle-event-wiring`, `feature/nextjs-16-upgrade`,
`feature/dashboard-global-search`) branched from `main` once Phase 6's
hardening work is merged, per this repo's own "one issue = one branch"
rule (`CLAUDE.md` §3.5).

## Recommended milestones, in implementation order

1. **Architecture Enforcement Expansion** - extend
   `scripts/architecture-check.ts` to check `PLATFORM_ARCHITECTURE_STANDARDS.md`'s
   general dependency rules (module-to-module isolation,
   `shared/` never importing from a business module) beyond the Storage
   Platform specifically. Tooling-only, no runtime code touched.
2. ~~**Documentation Corrections**~~ - **Done** (Release Completion pass):
   root `CLAUDE.md` §3's stale "no git CLI" deployment section corrected,
   and the `RELEASE_CHECKLIST.md`/`docs/releases/RELEASE_CHECKLIST_V1.md`
   naming collision resolved by renaming the former to
   `docs/releases/RELEASE_CHECKLIST_STORAGE_PLATFORM_V2.1.md`
   (`TECHNICAL_DEBT.md` #2-3).
3. **R2 CORS Configuration** - a Cloudflare dashboard action (not a code
   change) to close the one remaining infrastructure blocker
   (`R2_PRODUCTION_READINESS.md`). Unblocks, but does not itself decide,
   any future R2 adoption.
4. **Wire `VehicleEventPublisher` real call-sites + migrate Vehicle 360's
   Timeline to read from `vehicle_events`** - the Phase 4.5 framework has
   been built and tested in isolation since; MQR's/PM's `create()`/
   status-transition code still don't call it, and Vehicle 360 still
   aggregates via its own provider registry. This is genuine, scoped
   business-module work (unlike everything in this freeze).
5. **Extend automated test coverage to UI components** - `records/`,
   `report/`, `admin/*` still have no automated coverage
   (`PROJECT_STATE.md`'s own tracked gap). Doing this *before* the
   framework upgrade below gives a real regression safety net for the
   highest-risk item on this list.
6. **Next.js 14→16 / React 18→19 major upgrade** - the single biggest
   open risk item repo-wide (`TECHNICAL_DEBT.md` #10): 7 npm audit
   findings, a `jose` major bump (auth-critical), a Tailwind
   config-format-breaking major bump, and several other cascading
   majors. Sequenced after test coverage improves specifically so
   regressions are catchable.
7. **Phase 5c - Service Intelligence Dashboard + Global Search** -
   net-new feature work (unstarted), sequenced last so it builds on a
   hardened, better-tested, up-to-date foundation rather than adding
   feature surface area on top of known open risk.

Optional, not sequenced (do only if/when explicitly decided): adopting
Cloudflare R2 as an active default anywhere, once CORS is configured and
a separate approval is given (`docs/engineering/STORAGE_PLATFORM_DECISION.md`).

## Estimated risks

| Milestone | Risk | Why |
| --- | --- | --- |
| 1. Architecture Enforcement Expansion | Low | Tooling-only; a new false positive is easy to spot and adjust before it blocks anyone. |
| 2. Documentation Corrections | Low | Doc-only, no code path affected. |
| 3. R2 CORS Configuration | Low (execution) / External (dependency) | No code change; depends on Cloudflare dashboard access outside this repo. |
| 4. Vehicle Event wiring + Timeline migration | **Medium** | Touches MQR's/PM's `create()`/status-transition code (business logic) and changes what Vehicle 360 reads its Timeline from - a real behavior-surface change, needs careful before/after comparison so displayed history doesn't silently change. |
| 5. UI test coverage expansion | Low-Medium | Additive (new tests only) but touches every existing UI component's assumptions - some may reveal latent bugs once tested for the first time. |
| 6. Next.js 14→16 / React 18→19 upgrade | **High** | Two major framework versions at once, cascading into auth-critical (`jose`) and build-critical (`tailwindcss`) majors; the biggest blast radius of anything on this list. Do not attempt without milestone 5's expanded test coverage in place first. |
| 7. Phase 5c Dashboard + Global Search | Medium | New feature surface, no prior code to regress, but real scope (Executive/Dealer/Technician/MQR/Campaign KPIs + a global search box) - a multi-milestone effort in its own right. |

No milestone above is scheduled or approved by this document - each
requires its own explicit go-ahead, verification pass, and report,
exactly as every Storage Platform milestone did.
