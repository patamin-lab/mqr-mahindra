import { ReactNode } from 'react';
import Link from 'next/link';

/**
 * Shared timeline row (docs/standards/UI_COMPONENT_STANDARD.md "Timeline"
 * consolidation) - extracted from the two independently-built
 * implementations found in the audit: Vehicle 360's `TimelineRow` (a
 * clickable `<Link>` row with a reference-number chip and description) and
 * the MQR Audit Trail's inline `<li>` (a non-clickable row with a
 * field-change diff line). The shared date/badge markup was identical
 * between the two; everything that differed (link vs. no link, extra
 * leading chip, trailing content, body) stays a prop/child so each caller
 * renders exactly what it did before extraction.
 */
export interface TimelineItemProps {
  /** `<li>` className - the two source implementations use different
   *  spacing/border treatments, so this has no default. */
  liClassName: string;
  /** Wraps the row in a `<Link href={href} className="block">` when set
   *  (Vehicle 360's Life Cycle rows link to the source record). */
  href?: string;
  date: ReactNode;
  badge: ReactNode;
  /** Extra content in the top row's left cluster, after the badge
   *  (Vehicle 360's reference-number chip). */
  leadingExtra?: ReactNode;
  /** Right-aligned content in the top row (Vehicle 360's status text /
   *  the Audit Trail's "by {user}" text). */
  trailing?: ReactNode;
  /** Body content below the top row (description paragraph / field-change
   *  diff line). */
  children?: ReactNode;
}

export default function TimelineItem({
  liClassName,
  href,
  date,
  badge,
  leadingExtra,
  trailing,
  children,
}: TimelineItemProps) {
  const topRow = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-400">{date}</span>
        <span className="rounded-full bg-brand-dark/5 px-2 py-0.5 text-xs font-medium text-brand-dark">{badge}</span>
        {leadingExtra}
      </div>
      {trailing}
    </div>
  );

  return (
    <li className={liClassName}>
      {href ? (
        <Link href={href} className="block">
          {topRow}
          {children}
        </Link>
      ) : (
        <>
          {topRow}
          {children}
        </>
      )}
    </li>
  );
}
