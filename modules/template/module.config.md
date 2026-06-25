# Template: module.config

Convention for a module's identity. As of Sprint 2 there is no runtime
config loader — no module reads this at startup. This documents the shape
a real `modules/<name>/module.config.ts` (or `.json`) should take once a
module is actually built, so every module declares itself the same way.

## Fields

| Field | Purpose |
|---|---|
| `id` | Slug, matches the folder name (`pdi`, `warranty`, `parts-request`, …) |
| `displayName` | `{ th: string; en: string }` — app is bilingual (TH/EN toggle, see `.claude/rules/04-ui-feedback-conventions.md`) |
| `owner` | Who to ask about this module's business rules |
| `status` | `planned \| in-progress \| active \| deprecated` |
| `dependsOn` | List of `shared/` pieces this module uses (e.g. `shared/db`, `shared/uploads`) — never another module |
| `permissions` | Roles/scopes this module introduces or consumes, beyond the base dealer/branch/role scoping every module gets for free via `applyScope()` |
| `nav` | `{ label, href, icon, order }` — the entry this module contributes to the shared sidebar/nav data list (see `docs/MODULE_GUIDE.md` §3.4: the shell stays generic, modules register themselves) |

## Illustrative shape (not real code)

```
{
  id: "pdi",
  displayName: { th: "ตรวจสภาพก่อนส่งมอบ", en: "Pre-Delivery Inspection" },
  owner: "TBD",
  status: "planned",
  dependsOn: ["shared/db", "shared/uploads", "shared/auth"],
  permissions: [],
  nav: { label: "PDI", href: "/pdi", icon: "ClipboardCheck", order: 20 }
}
```

## Rule

Do not create this file with real values for a module that doesn't exist
yet. This template is filled in *as part of* building a module, not ahead
of it.
