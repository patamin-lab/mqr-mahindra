import { ReactNode } from 'react';

/**
 * Shared timeline list shell (docs/standards/UI_COMPONENT_STANDARD.md
 * "Timeline" consolidation) - the `<ol>` wrapper around a series of
 * `TimelineItem`s. Pairs with TimelineItem.tsx.
 */
export interface TimelineProps {
  children: ReactNode;
  className?: string;
}

export default function Timeline({ children, className }: TimelineProps) {
  return <ol className={className ?? 'space-y-2 text-sm'}>{children}</ol>;
}
