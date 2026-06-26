# assets/

Static assets specific to this one module only.

## Convention

- This folder is expected to stay **empty for most modules**. The default is that an asset belongs in the repo-root `public/` directory if it's reusable platform-wide (e.g. `public/fonts` already holds the Sarabun fonts every module's PDF export depends on) — not here.
- Use this folder only for an asset that is genuinely specific to this module and has no plausible reuse elsewhere — e.g. a one-off icon used only on this module's dashboard card.
- Anything placed here still follows `docs/DESIGN_SYSTEM.md`'s icon and imagery conventions; module-specificity is about ownership/location, not a license to diverge visually.

## Relationship to other docs

- `docs/DESIGN_SYSTEM.md` — icon and imagery conventions that still apply here.
- `public/` (repo root) — where a shared, reusable asset belongs instead.

## Status

Empty, and expected to remain empty unless a module has a genuine asset need that isn't shared.
