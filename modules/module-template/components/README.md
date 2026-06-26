# components/

Module-local UI components — anything specific to this module's screens that isn't generic enough to live in `shared/ui/` or `shared/admin/` yet.

## Convention

- PascalCase filenames matching the exported component: `PartsRequestForm.tsx`.
- A component starts here. It only moves to `shared/ui/` once a second module genuinely needs it, or that need is already known and planned (`docs/MODULE_ARCHITECTURE.md` §5). Promoting a component is a separate, explicit change — not something that happens quietly inside a module's own commit.
- The app shell (header, sidebar, layout) is never module-owned; it always lives in `shared/ui/` (see `docs/DESIGN_SYSTEM.md`).
- Visual styling follows `docs/DESIGN_SYSTEM.md`; this folder does not define its own colors, spacing, or typography.

## Relationship to other docs

- `modules/template/components-template.md` — the Sprint 2 convention this folder implements literally.
- `shared/ui/README.md`, `docs/COMPONENT_CATALOG.md` — check here first; most table, card, and form primitives a new module needs already exist.
- `docs/DESIGN_SYSTEM.md` — the visual language every component here must follow.

## Status

Empty. No component has been written for any module yet (Sprint 6 is documentation/template only).
