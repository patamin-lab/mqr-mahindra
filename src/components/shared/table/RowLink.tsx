import Link from 'next/link';

/**
 * Platform "clickable row" helper (Phase 2 list-page standardization,
 * Row Interaction requirement: "Clicking a row opens View... Support
 * Ctrl/Cmd + Click"). A real `<a>` (via `next/link`) stretched to cover
 * the entire `<tr>` via `absolute inset-0` - the standard "stretched
 * link" table pattern: native browser behavior (Ctrl/Cmd+Click opens in
 * a new tab, middle-click, right-click "Open in new tab") with zero JS,
 * and `z-0` so any interactive element placed after it in the row
 * (`ActionColumn`, a status pill link) still receives its own clicks
 * uncontested since real DOM elements always win over an element behind
 * them.
 *
 * Usage: put `position: relative` on the `<tr>` itself (the positioning
 * context the stretched anchor fills - `inset-0` skips non-positioned
 * ancestors, so the anchor doesn't need to be a direct child of the
 * `<tr>`, just a descendant of it), render `<RowLink>` as the first
 * child of the first `<td>`, and give every cell whose own content must
 * stay independently clickable (e.g. the `ActionColumn` cell) a
 * `relative z-10` wrapper so it stacks above the link (`z-0`).
 */
export default function RowLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="absolute inset-0 z-0" aria-label={label}>
      <span className="sr-only">{label}</span>
    </Link>
  );
}
