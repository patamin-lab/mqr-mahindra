import { ReactNode } from 'react';

/**
 * Shared status/severity/health "pill" renderer
 * (docs/standards/UI_COMPONENT_STANDARD.md "Status Badges" consolidation).
 *
 * Deliberately generic over *shape* (`className`) and *color*
 * (`colorClassName`) rather than over the status vocabulary itself - MQR
 * status, severity, maintenance-due, and health-status each keep their own
 * domain-specific color map (that mapping logic was correct to keep
 * separate; only the `<span className="...">` rendering was duplicated).
 * Every call site passes the exact className combination it used before
 * extraction, so nothing here changes what's on screen.
 */
export interface StatusPillProps {
  children: ReactNode;
  colorClassName: string;
  /** Overrides the pill "shape" (padding/radius/weight) - defaults to the
   *  most common shape found across the app. */
  className?: string;
}

const DEFAULT_SHAPE = 'px-2 py-1 rounded-full text-xs font-medium';

export default function StatusPill({ children, colorClassName, className }: StatusPillProps) {
  return <span className={`${className ?? DEFAULT_SHAPE} ${colorClassName}`}>{children}</span>;
}
