# Table Guide

The shared table/row/inline-edit layout used by every admin module's
`<module>-table.tsx`. See `docs/ADMIN_FRAMEWORK.md` §5 for the supporting
evidence; confirmed at the full-JSX level in `dealers-table.tsx` and
`branches-table.tsx`.

## Layout

```
<div>
  [ create-new-record card — see FORM_GUIDE.md ]
  <table>
    <thead> one <th> per column, plus a trailing "actions" column </thead>
    <tbody>
      {items.map(item => (
        <tr key={item.id}>
          {/* one <td> per column */}
          {/* trailing <td> with row actions */}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

There is no shared `<Table>`, `<Row>`, or `<Cell>` component anywhere in
the codebase. Each of the five files hand-rolls this markup with its own
field names — this is the duplication Sprint 4 was asked to analyze. See
`docs/COMPONENT_CATALOG.md` (Sprint 3) for the original observation.

## Cell rendering — the inline-edit ternary

Every data `<td>` follows the same shape, gated by whether the row is the
one currently being edited:

```tsx
<td className="px-3 py-2">
  {editingId === item.id ? (
    <input
      className="border rounded px-2 py-1 w-full"
      value={editDraft.fieldName ?? item.fieldName}
      onChange={(e) => setEditDraft((d) => ({ ...d, fieldName: e.target.value }))}
    />
  ) : (
    <span>{item.fieldName}</span>
  )}
</td>
```

For enum-backed fields (Problem Codes' `severity`/`system`, Users' `role`),
the editing branch renders a `<select>` instead of an `<input>`, with
options sourced from a shared constant (`SEVERITY_VALUES`/`SEVERITY_LABELS`
from `@/lib/types`, or `assignableRoles(actorRole)` for Users specifically
— note this means the *options available while editing* are themselves
permission-filtered, not a fixed list).

## Row actions column

The trailing column renders different controls depending on `editingId`:

- Not editing: an "Edit" button (`onClick={() => { setEditingId(item.id);
  setEditDraft({}); }}`), plus any module-specific buttons.
- Editing: "Save" (`onClick={() => saveEdit(item.id)}`, disabled while
  `busy`) and "Cancel" (`onClick={() => { setEditingId(null); setEditDraft({}); }}`).

Module-specific additions, always rendered outside the edit/non-edit
ternary:

- **Users**: a "Reset password" button (visible regardless of edit state)
  and a delete button gated by the client-computed `iCanDelete` flag — the
  only table where a row action is conditionally hidden based on the
  *acting* user's role rather than always shown.
- **Dealers, Problem Codes**: no delete button; the active/inactive toggle
  is exposed as a field within the row (often a checkbox or the `active`
  select) rather than a separate action button.

## Scoping prop

Branches' and Technicians' table components accept a `lockedDealerId:
string | null` prop, used to pre-fill and disable the dealer field in both
the create card and the inline-edit cell when a `DealerAdmin` is viewing
their own dealer's records. This is a presentation-layer mirror of the
server-side dealer scoping already applied in `page.tsx` (see
`docs/ADMIN_FRAMEWORK.md` §1) — not a separate permission check, just a UI
convenience so the field isn't editable to a value the server would reject
anyway.

## What a generic table renderer would need

Per `docs/ADMIN_FRAMEWORK.md` §7's `columns` prop: each column needs at
minimum `key`, `label`, `editable`, and a `type` discriminator (`text` |
`select` | `password` | `readonly`) to drive which branch of the ternary
above renders. The row-actions column needs to stay outside the generic
column list and be driven by the `permissions`/`actions` props instead,
since it's the part of the layout most prone to module-specific behavior
(Users' extra buttons being the clearest example).
