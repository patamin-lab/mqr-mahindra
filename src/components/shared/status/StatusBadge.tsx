import StatusPill from './StatusPill';

/**
 * Shared active/inactive pill used across every admin master-data table
 * (Dealers, Branches, Technicians, Users, Problem Codes).
 *
 * Extracted verbatim from the identical inline markup that previously lived
 * in each `*-table.tsx` file - same classNames, same default Thai labels.
 * No visual or behavioral change versus the original. Now composes the
 * shared `StatusPill` renderer rather than its own `<span>`.
 */
export type StatusBadgeProps = {
  active: boolean;
  activeLabel?: string;
  inactiveLabel?: string;
};

export default function StatusBadge({ active, activeLabel = 'ใช้งาน', inactiveLabel = 'ปิดใช้งาน' }: StatusBadgeProps) {
  return (
    <StatusPill
      className="px-2 py-0.5 rounded text-xs"
      colorClassName={active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
    >
      {active ? activeLabel : inactiveLabel}
    </StatusPill>
  );
}
