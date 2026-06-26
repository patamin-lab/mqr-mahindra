# CRUD Guide

How every admin table component manages create/edit/save state today, and
how that flow would generalize into a shared hook. See
`docs/ADMIN_FRAMEWORK.md` §2 for the evidence behind this guide.

## The flow as it exists today

Confirmed identical (modulo entity/field names) in `dealers-table.tsx` and
`branches-table.tsx` (both read in full), and consistent with every import
and state declaration seen in `users-table.tsx`, `technicians-table.tsx`,
and `problem-codes-table.tsx`.

### State

```ts
const [items, setItems] = useState<Entity[]>(initialItems);
const [busy, setBusy] = useState(false);
const [editingId, setEditingId] = useState<string | null>(null);
const [editDraft, setEditDraft] = useState<Partial<Entity>>({});
const [newItem, setNewItem] = useState<NewItemShape>({ /* '' for every field */ });
```

`newItem` is its own separate state object, not `Partial<Entity>` — every
field defaults to an empty string rather than being absent. This is a
deliberate distinction from `editDraft`, which starts empty (`{}`) and is
merged against the existing row's values at render time
(`editDraft.field ?? row.field`).

### Create

```ts
async function createEntity() {
  setBusy(true);
  swalLoading('กำลังเพิ่ม...');
  try {
    const json = await fetchJson<{ ok: boolean; error?: string; entity: Entity }>(
      '/api/admin/<module>',
      { method: 'POST', body: JSON.stringify(newItem) },
    );
    if (!json.ok) throw new Error(json.error);
    setItems((prev) => [...prev, json.entity].sort(/* module-specific comparator */));
    setNewItem({ /* reset to empty defaults */ });
    swalClose();
  } catch (err) {
    swalClose();
    showError(err);
  } finally {
    setBusy(false);
  }
}
```

### Edit

Entering edit mode sets `editingId` to the row's id and seeds `editDraft`
(usually `{}`, relying on the `??` fallback at render time). Saving:

```ts
async function saveEdit(id: string) {
  setBusy(true);
  swalLoading('กำลังบันทึก...');
  try {
    const json = await fetchJson<{ ok: boolean; error?: string; entity: Entity }>(
      `/api/admin/<module>/${id}`,
      { method: 'PATCH', body: JSON.stringify(editDraft) },
    );
    if (!json.ok) throw new Error(json.error);
    setItems((prev) => prev.map((x) => (x.id === id ? json.entity : x)));
    setEditingId(null);
    setEditDraft({});
    swalClose();
  } catch (err) {
    swalClose();
    showError(err);
  } finally {
    setBusy(false);
  }
}
```

### Error handling

Every file defines its own local `showError(err)` — checks whether `err`
is a `FetchJsonError` (from `@/lib/fetchJson`) to extract a server-supplied
Thai message, falling back to a generic message otherwise, then calls
`swalError(...)`. This is the single biggest pure-logic duplication found
across the five files and the lowest-risk first extraction (see
`docs/ADMIN_FRAMEWORK.md` §9, step 2).

### Module-specific bolt-ons (not part of the base flow)

- **Users**: `toggleActive(u)` (`PATCH { active: !u.active }`) and
  `resetPassword(u)` (`swalPrompt` for a new value, then `POST` to
  `/api/admin/users/[id]/reset-password`).
- **Dealers, Problem Codes** (confirmed) use the same `saveEdit` PATCH path
  to flip an `active: boolean` field rather than exposing a delete action.

## Proposed shared hook

```ts
function useAdminCrud<T extends { id: string }>(opts: {
  api: string;
  initialItems: T[];
  newItemDefaults: Record<string, string>;
  sort?: (a: T, b: T) => number;
}) {
  // returns: items, busy, editingId, editDraft, newItem,
  //          setEditingId, setEditDraft, setNewItem,
  //          createItem(), saveEdit(id), and a generic
  //          `runAction(method, url, body)` escape hatch for bolt-ons
  //          like toggleActive/resetPassword.
}
```

This hook would cover §"The flow as it exists today" exactly as written
above — no behavior change, just relocating identical code. Bolt-ons stay
as small, module-local functions built on top of the hook's `runAction`
primitive rather than being absorbed into the hook itself, since they
differ per module (see `docs/ADMIN_FRAMEWORK.md` §7 on why `AdminCrud`
should not try to predict every bolt-on).

This is a design proposal only. No hook exists in the codebase today, and
implementing one is out of scope for this sprint.
