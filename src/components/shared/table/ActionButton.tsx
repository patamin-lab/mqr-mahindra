import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

/**
 * Platform Action Button (Phase 2 list-page standardization) - one icon
 * button, soft-colored per intent, rounded, with a hover animation and a
 * native tooltip (`title`), reused by every report/list page's Action
 * Column instead of each page inventing its own row-action markup.
 * Renders a `<Link>` when `href` is given (View/Edit/Export - plain
 * navigation, works inside a Server Component list page) or a `<button>`
 * when `onClick` is given (Delete and any other client-side action).
 */
export type ActionButtonVariant = 'view' | 'edit' | 'export' | 'delete' | 'neutral';

const VARIANT_CLASSES: Record<ActionButtonVariant, string> = {
  view: 'text-status-info bg-status-info/10 hover:bg-status-info/20',
  edit: 'text-brand-red bg-brand-red/10 hover:bg-brand-red/20',
  export: 'text-gray-600 bg-gray-100 hover:bg-gray-200',
  delete: 'text-status-danger bg-status-danger/10 hover:bg-status-danger/20',
  neutral: 'text-gray-500 bg-gray-100 hover:bg-gray-200',
};

const BASE_CLASSES =
  'inline-flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-150 ' +
  'hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-brand-red disabled:pointer-events-none disabled:opacity-40';

export interface ActionButtonProps {
  icon: LucideIcon;
  label: string;
  variant?: ActionButtonVariant;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  download?: boolean;
  /** Opens `href` in a new tab (e.g. an export/print target) rather than
   *  navigating the current page away from the list. */
  external?: boolean;
}

export default function ActionButton({
  icon: Icon,
  label,
  variant = 'neutral',
  href,
  onClick,
  disabled,
  download,
  external,
}: ActionButtonProps) {
  const className = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]}`;

  if (href && !disabled) {
    if (external || download) {
      return (
        <a
          href={href}
          title={label}
          aria-label={label}
          className={className}
          onClick={(e) => e.stopPropagation()}
          {...(download ? { download: true } : { target: '_blank', rel: 'noreferrer' })}
        >
          <Icon size={16} aria-hidden="true" />
        </a>
      );
    }
    return (
      <Link href={href} title={label} aria-label={label} className={className} onClick={(e) => e.stopPropagation()}>
        <Icon size={16} aria-hidden="true" />
      </Link>
    );
  }

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <Icon size={16} aria-hidden="true" />
    </button>
  );
}
