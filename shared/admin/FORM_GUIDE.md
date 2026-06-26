# Form Guide

The shared "create new record" form-card layout, rendered above the table
in every admin module. See `docs/ADMIN_FRAMEWORK.md` §6 for the supporting
evidence; confirmed at full-JSX level in `dealers-table.tsx` and
`branches-table.tsx`.

## Layout

```tsx
<div className="bg-white rounded-xl shadow-sm border p-4 grid grid-cols-2 gap-3">
  <div>
    <label className="text-sm text-gray-600">ชื่อย่อ</label>
    <input
      className="border rounded px-2 py-1 w-full"
      value={newItem.shortName}
      onChange={(e) => setNewItem((d) => ({ ...d, shortName: e.target.value }))}
    />
  </div>
  {/* one such block per field */}
  <button onClick={createEntity} disabled={busy}>เพิ่ม</button>
</div>
```

Every field is a controlled input: value comes from `newItem`, `onChange`
spread-updates the same object. There is no shared `<FormField>` or
`<FormRow>` component — every file repeats this block per field, with
different labels and keys. This is the same duplication pattern as
TABLE_GUIDE.md, just for the create form instead of the row markup.

## Field types observed

| Type | Where seen | Notes |
|---|---|---|
| Plain text | All modules (`short_name`, `full_name`, `address`, `username`, `mobile`, `email`, etc.) | Default case |
| Password | Users only | Create form only — there is no "password" column in the table itself |
| Enum `<select>` | Users (`role`), Problem Codes (`severity`, `system`) | Options come from shared constants/functions, not hardcoded per file |

For Problem Codes, the `system` select is backed by a page-local
`SYSTEM_LABEL: Record<'powertrain' | 'other', string>` map (`{ powertrain:
'Powertrain (48 เดือน)', other: 'อื่นๆ (24 เดือน)' }`), and `severity` by
`SEVERITY_VALUES`/`SEVERITY_LABELS` imported from `@/lib/types`. For Users,
`role` options come from `assignableRoles(actorRole)` (see
PERMISSION_GUIDE.md) — meaning the create form's own option list is itself
permission-filtered, not a static enum render.

## Locked/disabled fields

Branches' (and presumably Technicians') create form disables the dealer
field and pre-fills it from the `lockedDealerId` prop when the acting user
is scoped to a single dealer. This should be modeled as a column-level
`locked?: (props) => string | undefined` concept in any generic form
renderer, not a one-off special case, since the same need
(actor-scoped-value, not editable) is likely to recur for any future
dealer-scoped entity.

## What a generic form renderer would need

The same `columns` shape proposed in `docs/ADMIN_FRAMEWORK.md` §7 covers
this directly: `type: 'text' | 'select' | 'password'`, `options`/`labels`
for selects, and a way to mark a field as locked-to-a-value rather than
freely editable. No new prop shape is needed beyond what's already
proposed for `<AdminCrud>` — the create form and the inline-edit cell are
two renderings of the same column metadata, which is the main argument for
keeping `columns` a single shared array rather than separate config for
"create" vs. "edit."
