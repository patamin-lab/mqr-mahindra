/**
 * Shared active/inactive status pill for admin CRUD tables. Matches the
 * exact markup + classNames that were duplicated across users-table.tsx,
 * branches-table.tsx, technicians-table.tsx and dealers-table.tsx.
 */
export type ActiveBadgeProps = {
  active: boolean | null | undefined;
  activeLabel?: string;
  inactiveLabel?: string;
};

export default function ActiveBadge({ active, activeLabel = 'ใช้งาน', inactiveLabel = 'ปิดใช้งาน' }: ActiveBadgeProps) {
  return (
    <span className={`px-2 py-0.5 rounded text-xs ${active === false ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
      {active === false ? inactiveLabel : activeLabel}
    </span>
  );
}
