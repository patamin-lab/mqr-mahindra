/**
 * Generic "loading" placeholder row for AdminCrudTable. Same status as
 * EmptyState - scaffolded for the shared library, not wired into any
 * migrated screen yet since none of the five admin tables showed a loading
 * row before this sprint.
 */
export type LoadingStateProps = {
  colSpan: number;
  message?: string;
};

export default function LoadingState({ colSpan, message = 'กำลังโหลด...' }: LoadingStateProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-gray-400">
        {message}
      </td>
    </tr>
  );
}
