/**
 * Page/section-level Error State (MSEAL Design Framework, ADR-023,
 * ERROR_STATE_GUIDELINE.md). Always names the four things the Guideline
 * requires: Problem, Reason, Resolution, and (when the failure might be
 * transient) a Retry action - never a bare "Something went wrong."
 */
export interface ErrorStateProps {
  problem: string;
  reason: string;
  resolution: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export default function ErrorState({ problem, reason, resolution, onRetry, retryLabel = 'Retry' }: ErrorStateProps) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
      <div className="text-2xl mb-2" aria-hidden="true">⚠️</div>
      <div className="font-semibold text-red-700 text-sm">{problem}</div>
      <p className="text-xs text-red-600 mt-1 max-w-sm mx-auto">{reason}</p>
      <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">{resolution}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn btn-secondary mt-3 text-xs px-3 py-1.5">
          {retryLabel}
        </button>
      )}
    </div>
  );
}
