# CLAUDE.md

This file orients an AI engineer (or any new contributor) working on **MQR — Market Quality Report**, Mahindra's dealer quality-incident reporting system. Read this fully before writing or changing any code.

## 1. What this system does

Dealers and their technicians file a "quality incident report" (QIR) whenever a vehicle has a failure — serial number, problem code/severity, photos, video, GPS location, root cause, parts, repair outcome. Central/regional admins review, filter, export, and track these via a KPI dashboard. Every report gets a PDF (with QR code) and is emailed out via Resend. Vehicle master data syncs in from a "Tractor IN" Google Sheet into Supabase.

## 2. Tech stack

- **Next.js 14.2.35**, App Router, TypeScript, deployed on **Vercel** (team `MSEAL`, Hobby plan).
- **Supabase** (Postgres 17, project `lhlzzxjayywqhqtjzfiu`, region ap-northeast-2) — DB + RLS. No Supabase Auth; auth is custom (see §6).
- **Tailwind CSS** for styling; **SweetAlert2** for all user-facing popups/alerts (never plain `alert()` or inline error banners — see §8.4).
- **Google Drive** (OAuth2, not service account) is the file store for report photos/video — not Supabase Storage.
- **Resend** for transactional email; **react-pdf** for PDF generation (QR code + Sarabun Thai font, TTF not WOFF — react-pdf can't load WOFF server-side).
- **jose** for JWT session signing; custom SHA-256 password hashing (legacy-compatible with the old Apps Script system it replaced).
- Repo: `github.com/patamin-lab/mqr-mahindra` (**public** - verified via `gh repo view --json visibility,isPrivate`; corrected by the Platform Governance Framework's repository-visibility resolution, `docs/governance/REPOSITORY_POLICY.md` §1 - this line previously said "private," which had drifted from actual repository state), branch `main`. Live: `masp-mseal.vercel.app` - this line previously said `mqr-mahindra.vercel.app`, which was never the real production alias (confirmed 2026-07-16: it 404s with `DEPLOYMENT_NOT_FOUND`; `masp-mseal.vercel.app` is the actual, working production URL, live-verified the same session).

## 3. Deployment workflow — READ THIS BEFORE PUSHING ANYTHING

**A working git CLI and a checked-out local working tree are available in this environment**, with a real `origin` remote (`github.com/patamin-lab/mqr-mahindra`) — use normal `git` commands (`status`/`diff`/`add`/`commit`/`push`) rather than the GitHub web UI. Vercel auto-deploys every push to `main`; use `vercel deploy` (no `--prod`) for a Preview deployment of a feature branch first. This section previously described a no-git-CLI, upload-only workflow — that has not reflected the actual environment since at least the Storage Platform build-out, and is corrected here.

Operational rules that have proven necessary in practice:

- **Never commit, push, merge, tag, rebase, force-push, or rewrite history without explicit user instruction for that specific action** — see `.claude/rules/git.md` for the full, binding git safety rules.
- **After pushing, verify the deploy** on Vercel (Preview URL status, or the GitHub *Deployments* tab for production) — look for a `READY`/"Deployed (completed)" state rather than assuming success.
- **Never put credentials, tokens, or passwords into any command, field, or URL**, even if explicitly supplied/authorized by the user. If a step requires manual credential entry, stop and ask the user to do it. (Narrow, pre-established exceptions: GitHub's own auto-generated raw-content URL token encountered while *browsing* in an authenticated session is a navigation artifact, not something being "entered"; the Google Drive resumable-upload session URL is passed server→client via the custom header `X-Drive-Session-Url`, never as a query string or exposed token.)
- Always run `git status`/`git diff` before editing to confirm the working tree's actual current state — don't assume it matches a prior session's memory.

## 3.5 Engineering Working Agreement

Before every issue:

- Verify `git status`, current branch, `HEAD`, and that the repository is synchronized.
- The working tree must be clean.

Dependency rule:

- Whenever `package.json` changes, `package-lock.json` must be updated in the same commit.
- Never leave them out of sync.

Branching rule:

- One issue = one branch: `feature/<issue-name>`.
- One logical change only.
- Do not mix dependency updates, refactoring, feature work, or formatting into the same branch or commit.

Commit series rule:

- One issue = one commit series.
- Use descriptive, issue-scoped commit messages.

Pre-PR rule:

- Run `npm.cmd run lint`, `npm.cmd run typecheck`, and `npm.cmd run build` before opening a pull request.
- The repository must be clean.
- No `TODO`, `FIXME`, `NotImplemented`, `console.log`, placeholder code, or disabled production UI in committed production code.

Post-issue rule:

- Never start the next issue automatically.
- After every completed issue, provide:
  - Files changed
  - Architecture impact
  - API impact
  - Database impact
  - Breaking changes
  - Build status
  - Lint status
  - Typecheck status
  - Commit SHA
- Wait for engineering review.

Grounding rule:

- Before modifying any feature, always inspect:
  - existing implementation
  - related types
  - repository
  - service
  - API
  - ADR
  - database schema (if applicable)
- Never write code from memory.

Scope rule:

- Never modify files outside the approved Issue scope.
- If additional files become necessary:
  - STOP
  - explain why
  - request approval
- Do not silently expand scope.

Source of truth priority:

1. Current Git working tree
2. Current branch `HEAD`
3. Database schema
4. ADR
5. Documentation

If documentation differs from code, report the mismatch. Never assume.

## 3.6 Post-v1.1.0 Development Standard

**Current baseline: MASP Platform Foundation v1.1.0 (tag `v1.1.0`) — COMPLETE.** Full record: `docs/releases/MASP_PLATFORM_FOUNDATION_V1.1.md`. Do not redesign or rewrite a completed platform foundation unless there is a confirmed bug, security issue, or measurable performance problem.

**Frozen platform layers** (feature-frozen — bug/security/performance fixes only): Attachment Platform, Storage Platform, DealerBranchScope, Historical Import Framework. These are platform standards now — every new feature reuses them; never a parallel implementation. Binding detail: `docs/architecture/PLATFORM_ARCHITECTURE_STANDARDS.md`'s Storage rules and Authorization rules sections.

Every business module's file storage follows `Business Module → AttachmentService → AttachmentRepository → StorageProviderFactory → Supabase/Cloudflare R2`. Every business module's dealer/branch authorization follows `UI → DealerBranchScope → Repository scope (applyScope()) → Database` — no module implements either independently (§6, §8.2).

**Next development phase priority order** (see `docs/ROADMAP.md`'s "Next Development Phase" section): Workflow Engine → Service Management → Customer Experience → Machine Intelligence → Predictive Maintenance. Each integrates with the shared platforms above rather than building new infrastructure; none are scheduled or scoped yet — each requires its own explicit milestone.

**Verification before claiming completion**: lint, typecheck, tests, build, architecture check — all of them, every time, not just at the end. If a Preview deployment exists, perform live UAT against it. Never claim success without the evidence to back it.

**Release policy**: Production Ready only if build, tests, architecture check, Preview, and live UAT all pass and there is no open release blocker. Otherwise stop and report the blocker, its severity, and the affected module(s) — do not claim completion for work that could not actually be verified.

## 4. Repository structure

```
src/
  middleware.ts            # auth gate; excludes /fonts/* (react-pdf needs unauthenticated font fetch)
  app/
    login/                 # login page
    (app)/                 # authenticated app shell
      layout.tsx           # shared shell
      sidebar.tsx          # nav, incl. mobile drawer
      dashboard/           # KPI dashboard (page.tsx + charts.tsx)
      records/             # list view (page.tsx) + [jobId]/ detail+edit view
      report/              # the QIR submission form
        report-form.tsx    # ⚠ the most complex file in the repo — see §8
        location-picker.tsx, map-view.tsx
      admin/                # master-data management, gated by scope.ts
        dealers/ branches/ technicians/ users/ problem-codes/
    api/
      auth/{login,logout}/
      records/             # list+create; [jobId]/ (get/update/soft-delete) + export/
      upload/               # see §8.2 — route.ts (direct ≤4MB), init/ chunk/ finalize/ (>4MB relay)
      vehicles/             # [serial]/ list/ search/ — backed by the Tractor-IN sync
      branches/ technicians/
      admin/                # dealers/ users/ problem-codes/ (each with [id]/ for single-record ops)
  lib/
    auth.ts          # JWT session sign/verify, getSession(), sha256Hex()
    scope.ts         # RBAC predicates — see §6
    db.ts            # all Supabase queries, incl. dashboardStats(), listRecords()
    supabase.ts       # Supabase client init
    googleDrive.ts    # Drive OAuth2 upload/finalize/permissions
    fetchJson.ts      # typed fetch wrapper — see §8.3
    swal.ts           # SweetAlert2 helpers — see §8.4
    thaiDate.ts        # GMT+7 / พ.ศ. formatting — see §8.1
    exportPdf.tsx     # react-pdf report layout
    exportExcel.ts    # list/single/monthly-summary Excel export
    email.ts          # Resend notification
    tractorSheet.ts   # Google Sheet → Supabase vehicle sync
    warranty.ts
    types.ts          # shared types incl. SessionUser, Role
scripts/
  get-google-refresh-token.mjs   # one-off OAuth2 setup helper, not run in prod
```

## 5. Database (Supabase, `public` schema, RLS enabled on every table)

| Table | Purpose | Notable columns |
|---|---|---|
| `dealers` | dealer master | `id` (text PK, e.g. dealer code), `active` |
| `branches` | dealer branches | FK → `dealers` |
| `technicians` | per-dealer technician roster | FK → `dealers` |
| `users` | login accounts | `role` (enum, see §6), `password_hash`/`password_salt`/`password_algo`, FK → `dealers` |
| `vehicles` | synced from Tractor-IN sheet | `serial` (unique), `model`, `delivery_date`, FK → `dealers` |
| `problem_codes` | failure taxonomy | `system` (powertrain/other), `default_severity` |
| `parts` | spare-parts stock (not yet wired into the UI) | |
| `records` | the QIR reports themselves | `job_id` (unique, format `QIR-YYMM-####`), `status` (Draft/Open/UnderInvestigation/WaitingParts/Repaired/Closed), `record_status` (Active/Deleted — **soft delete**, see §8.5), `severity` (Critical/Major/Minor), `photo_links` (jsonb array), `video_link`, `pdf_link`, lat/lng, FK → dealers/branches/technicians |
| `job_seq` | per-dealer-per-year counter for `job_id` generation | composite PK (`dealer_id`, `year`) |
| `login_log` | audit trail of login attempts | |

Always check `list_tables` (Supabase MCP) before assuming a column exists or writing a migration — this table is the source of truth, not memory of past sessions.

## 6. Auth & RBAC

- **No Supabase Auth.** Login is custom: `username`/`password` checked against `users.password_hash` (SHA-256, legacy-compatible), session is a JWT (via `jose`) signed with `SESSION_SECRET`, stored in cookie `mqr_session`, 180-minute expiry. `getSession()` in `lib/auth.ts` reads it server-side.
- **Four roles** (`users.role` check constraint): `SuperAdmin` > `CentralAdmin` > `DealerAdmin` > `DealerUser`. All RBAC predicates live in `lib/scope.ts` — do not duplicate role-check logic inline elsewhere; import from there:
  - `seesAllDealers`, `canUpdateStatus`, `canDelete`, `canExport`, `canManageUsers`, `canDeleteUsers`, `canCreateSuperAdmin`, `canManageMasterData`, `assignableRoles()`, `canManageRoleTarget()`.
- Every API route must enforce scope at the **query level** (e.g. filter by `dealer_id`), not just hide UI — `scope.ts`'s own comments flag this explicitly for delete/export.
- **Dealer/Branch Scope Platform Standard** (`lib/dealerBranchScope.ts`): the shared server-side module every module's dealer/branch filtering and authorization goes through — `resolveDealerScope`, `resolveBranchScope`, `assertBranchAccess`, `canAccessDealerBranch`. `DealerUser` visibility is **branch-scoped** (every record in their own `session.branchId`, not just records they personally created — a service branch is a team, not an individual; this replaced the old `seesOwnRecordsOnly` rule). `SessionUser.branchId` is the real `branches.id` used for this; `SessionUser.branch` is a legacy free-text display string only, never used for scoping. The client-side counterpart is `useDealerBranchScope()`/`<DealerBranchSelector>` (`components/shared/scope/`).

## 7. Coding standards for this project (binding — from the project owner)

Before writing code: **Analyze → Design → Plan → Implement → Test → Refactor → Document.** Concretely:

1. Read this file and the relevant existing code path fully before touching it — understand how the whole feature/architecture fits together, not just the function being changed.
2. Never break existing features. If a change touches a shared file (`db.ts`, `scope.ts`, `fetchJson.ts`, `swal.ts`, `report-form.tsx`), check every caller.
3. Reuse existing components/helpers (`swal.ts` popups, `fetchJson<T>()`, `thaiDate.ts` formatters, `scope.ts` predicates) instead of re-implementing inline.
4. Keep the architecture scalable and the code clean — production-ready, not a quick patch.
5. **No TODOs left in committed code. No incomplete implementations. No fake/mock data** unless the user explicitly asked for a stub/sample.
6. **If a requirement is unclear, ask — never guess.**
7. After implementing: test it for real (live-test on the deployed site when the change is user-facing — this codebase's standing instruction is to verify on the actual website, not just confirm a clean build), then refactor and document (comments for non-obvious "why", not "what").

## 8. Critical conventions & known gotchas

### 8.1 Timestamps must be GMT+7
Vercel's runtime clock is UTC. **Every** displayed timestamp (PDF export, Excel export, record detail, audit trail) must go through `formatThaiDateTime()` in `lib/thaiDate.ts`, which forces `Asia/Bangkok`. Never call `.toLocaleString()` or format a `Date` directly for display — it will silently drift 7 hours from the time it actually happened in Thailand. The same file holds พ.ศ./Thai-month helpers (`toBuddhistYear`, `formatMonthKeyThai`, `buildYearOptions`) — display only; all storage/filtering stays Gregorian/ISO.

### 8.2 Upload pipeline is size-routed (Drive CORS + Vercel body-size constraints)
`report-form.tsx` defines `PROXY_SAFE_BYTES = CHUNK_BYTES = 4 * 1024 * 1024` (4MB):
- **≤ 4MB**: client → `/api/upload` (multipart form, direct proxy, does HEIC→JPEG conversion server-side).
- **> 4MB**: client → `/api/upload/init` (opens a Drive resumable session **server-side**, returns a session URL) → client chunks the file into ≤4MiB pieces and PUTs each to **same-origin** `/api/upload/chunk`, which relays it server-to-server to Google Drive (validates the session URL starts with `https://www.googleapis.com/upload/drive/`) → `/api/upload/finalize` sets Drive sharing permissions and returns the public URL.
- **Why**: Vercel serverless functions cap request bodies at 4.5MB, and Google Drive's resumable-upload endpoint sends no CORS headers, so a direct browser→Drive PUT always fails with a generic "Failed to fetch". The relay avoids both. Don't "simplify" this back to a direct browser PUT — it was tried and fails.
- A newly-uploaded video showing "ยังอยู่ระหว่างประมวลผลไฟล์วิดีโอ…" in Drive's embedded player is **normal transcoding delay**, not an upload failure.

### 8.3 `fetchJson<T>()` typing discipline
`lib/fetchJson.ts` returns `Promise<T>` via an **unchecked cast** (`json as T`) — TypeScript will not catch a mismatch between what the API actually returns and what `T` claims, except where the *caller's* variable has its own declared type and the assignment narrows it. Concretely: always pick `T` to match the real response shape, and if you store the result in a variable with an explicit type, make sure they agree — a mismatch here is a real build-breaking error that has happened before (commit `7da3728` fixed exactly this).

### 8.4 SweetAlert2 only — no inline banners, no `alert()`
All user feedback (success, error, confirm, loading/progress) goes through `lib/swal.ts` (`swalLoading()`, `swalUpdateLoading()`, `swalClose()`, `swalError()`, plus success/confirm variants used across the admin tables and report form). Long-running actions (uploads) should show percentage progress via `swalUpdateLoading()`, following the pattern already in `report-form.tsx`'s `uploadOne()`/`onSubmit()`.

### 8.5 Records are soft-deleted
"ลบรายงาน" (delete report) sets `records.record_status = 'Deleted'` (plus `deleted_by`/`deleted_at`) — rows are never hard-deleted via the app UI. The confirm dialog text itself says so ("รายการจะถูกซ่อน ไม่สามารถกู้คืนได้เองในระบบ"). List/dashboard queries must filter `record_status = 'Active'`.

### 8.6 Vehicle data flows in from Google Sheets, not entered manually as the primary path
`vehicles` is populated by `lib/tractorSheet.ts` syncing the "Tractor IN" Google Sheet into Supabase. The report form's serial lookup queries this table; when a serial isn't found (sheet not yet synced, or a genuinely new/unlisted vehicle), the form falls back to a manual `stockNote` ("ที่มาของรถ") select — this is intended behavior, not a bug to "fix" by making lookup mandatory.

## 9. Current known work-in-progress (check the live task list before assuming status)

- Validation-bug-on-save (Safari "string did not match expected pattern") and the inline-banner→SweetAlert2 migration are tracked as separate, related in-progress items — both need final live re-verification together, since the same form (`report-form.tsx`) is involved.
- Loading/progress popup feedback is still being rolled out to action buttons beyond login/report-form.
- Mobile build/deploy/live-verify of recent fixes is still pending.
- A disposable QA account (`qa_test_temp`) exists in `users` for end-to-end testing — do not delete it until all pending form/upload verification work is done, and remember to clean up test `records` rows (soft-delete) after each test run.
