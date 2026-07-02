import { ReactNode } from 'react';
import Link from 'next/link';
import Card, { CardVariant } from './Card';

/**
 * Shared filter-bar shell (docs/standards/UI_COMPONENT_STANDARD.md
 * "Shared SearchToolbar" consolidation) - the `<form>`-as-`Card` wrapper
 * plus the trailing "Filter" button / "Clear filter" link pattern
 * duplicated between records/page.tsx and dashboard/page.tsx. Each page's
 * own filter fields (search box, selects, date pickers) stay as children -
 * only the repeated chrome around them was extracted.
 */
export interface SearchToolbarProps {
  children: ReactNode;
  cardVariant?: CardVariant;
  cardClassName: string;
  filterLabel: string;
  filterButtonClassName: string;
  clearHref?: string;
  clearLabel?: string;
  clearClassName?: string;
}

export default function SearchToolbar({
  children,
  cardVariant = 'elevated',
  cardClassName,
  filterLabel,
  filterButtonClassName,
  clearHref,
  clearLabel,
  clearClassName,
}: SearchToolbarProps) {
  return (
    <Card as="form" variant={cardVariant} className={cardClassName}>
      {children}
      <button className={filterButtonClassName}>{filterLabel}</button>
      {clearHref && (
        <Link href={clearHref} className={clearClassName ?? 'text-sm text-gray-500 underline'}>
          {clearLabel}
        </Link>
      )}
    </Card>
  );
}
