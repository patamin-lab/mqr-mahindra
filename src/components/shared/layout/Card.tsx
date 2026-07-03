import { ElementType, ReactNode } from 'react';

/**
 * Shared card/panel container (docs/standards/UI_COMPONENT_STANDARD.md
 * "Cards" consolidation). Three visually-different variants were found in
 * the audit - each is kept as a distinct, named preset rather than
 * normalized to one look, per this sprint's "preserve existing visual
 * appearance" rule. Callers pass whatever padding/extra layout classes
 * they used before extraction via `className`.
 */
export type CardVariant = 'elevated' | 'flat' | 'compact';

const VARIANT_CLASSES: Record<CardVariant, string> = {
  /** Matches globals.css's `.card` utility (shadow-card token, rounded-xl,
   *  border-gray-100) - records/page.tsx's table/filter-bar cards. */
  elevated: 'bg-white rounded-xl shadow-card border border-gray-100',
  /** `shadow-sm` instead of the `shadow-card` token, otherwise the same -
   *  dashboard's KpiCard/Panel, records/[jobId]/page.tsx's `<section>`s. */
  flat: 'bg-white rounded-xl shadow-sm border border-gray-100',
  /** `rounded` (4px) instead of `rounded-xl`, `border-gray-200` instead of
   *  `border-gray-100` - vehicles/[serial]/page.tsx, pm-records/[id]/page.tsx. */
  compact: 'rounded border border-gray-200 bg-white shadow-sm',
};

export interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  /** Padding/layout/spacing classes appended after the variant's base
   *  classes (e.g. "p-5", "p-6 space-y-4 grid grid-cols-2 gap-4"). */
  className?: string;
  /** Some call sites use `<section>` for document outline purposes. */
  as?: ElementType;
}

export default function Card({ children, variant = 'elevated', className, as: Tag = 'div' }: CardProps) {
  return <Tag className={`${VARIANT_CLASSES[variant]}${className ? ` ${className}` : ''}`}>{children}</Tag>;
}
