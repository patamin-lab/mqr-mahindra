/**
 * Generic "no rows" placeholder row for AdminCrudTable. Not wired into any
 * migrated screen yet - none of the five admin tables showed an empty-state
 * message before this sprint, so adding one would be a feature addition.
 * Available for screens that are designed to need it going forward.
 */
export type EmptyStateProps = {
  colSpan: number;
  message?: string;
};

export default function EmptyState({ colSpan, message = 'ไม่มีข้อมูล' }: EmptyStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-gray-400">
        {message}
      </td>
    </tr>
  );
}
