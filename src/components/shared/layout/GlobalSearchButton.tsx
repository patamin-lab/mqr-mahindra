'use client';

/**
 * Global Search placeholder (MSEAL Design Framework, ADR-023 refinement -
 * Platform Dashboard §4). UI-only, architecture-reserved slot in
 * `PlatformHeader` - no backend, no index, no query. Mirrors
 * `NotificationBell`'s exact pattern (disabled button + tooltip) rather
 * than inventing a new "coming soon" treatment, so the header has one
 * consistent placeholder language, not two.
 *
 * Data contract this will eventually wire into already exists and is not
 * duplicated here: `docs/SEARCH_MODEL.md` (Serial/Engine Number/Customer/
 * Dealer/Branch/Technician/Job Number, one shared `search` platform
 * service, tenant-scoped like any other query).
 */
export interface GlobalSearchButtonProps {
  label: string;
  comingSoonLabel: string;
  className?: string;
}

export default function GlobalSearchButton({ label, comingSoonLabel, className }: GlobalSearchButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled
      title={comingSoonLabel}
      className={`p-2 rounded-full text-white/50 cursor-not-allowed ${className ?? ''}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
      </svg>
    </button>
  );
}
