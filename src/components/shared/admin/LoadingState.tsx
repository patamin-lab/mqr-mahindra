/**
 * Generic "loading" placeholder for AdminCrudTable and any other shared
 * table - the ONE loading-skeleton implementation (Enterprise UI/UX
 * Standardization - Table Standard). Default `rows`/skeleton mode renders
 * animated shimmer bars per column, matching this table's real column
 * count so the loading state doesn't visually jump once data arrives.
 * The plain-text `message`-only mode is kept for any caller that prefers
 * a single-line loading row instead of a full skeleton.
 */
export type LoadingStateProps = {
  colSpan: number;
  message?: string;
  /** Skeleton mode (default): number of placeholder rows to render. Pass
   *  `0` to fall back to the plain single-line `message` row instead. */
  rows?: number;
};

export default function LoadingState({ colSpan, message = 'กำลังโหลด...', rows = 3 }: LoadingStateProps) {
  if (rows <= 0) {
    return (
      <tr>
        <td colSpan={colSpan} className="px-3 py-6 text-center text-sm text-gray-400">
          {message}
        </td>
      </tr>
    );
  }
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse">
          {Array.from({ length: colSpan }).map((__, colIndex) => (
            <td key={colIndex} className="px-3 py-3">
              <div className="h-3.5 rounded bg-gray-200" style={{ width: colIndex === 0 ? '70%' : '85%' }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
