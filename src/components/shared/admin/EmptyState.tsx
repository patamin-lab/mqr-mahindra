/**
 * Generic "no rows" placeholder row for a table body (`colSpan` + one short
 * message) - simpler than the richer `shared/layout/EmptyState` (icon/
 * title/reason/nextStep), for callers that just need one line inside a
 * `<tr>`. Actively used by `records/page.tsx`, `ntr/page.tsx`, and
 * `maintenance-history.tsx` (this doc comment previously said "not wired
 * into any migrated screen yet," which had drifted from actual usage).
 */
export type EmptyStateProps = {
  colSpan: number;
  message?: string;
};

export default function EmptyState({ colSpan, message = 'ไม่พบข้อมูลที่ตรงกับเงื่อนไขนี้' }: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-gray-400">
        {message}
      </td>
    </tr>
  );
}
