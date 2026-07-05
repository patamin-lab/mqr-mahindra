'use client';

/** Universal Import Framework — 5-step progress indicator. Purely
 *  presentational, no module knowledge; `currentStep` is 1-indexed. */
export default function StepIndicator({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs sm:gap-3 sm:text-sm">
      {steps.map((label, idx) => {
        const stepNumber = idx + 1;
        const isDone = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-semibold ' +
                (isDone ? 'bg-green-600 text-white' : isActive ? 'bg-brand-red text-white' : 'bg-gray-200 text-gray-500')
              }
            >
              {isDone ? '✓' : stepNumber}
            </span>
            <span className={isActive ? 'font-semibold text-brand-dark' : 'text-gray-500'}>{label}</span>
            {stepNumber < steps.length && <span className="mx-1 text-gray-300">→</span>}
          </li>
        );
      })}
    </ol>
  );
}
