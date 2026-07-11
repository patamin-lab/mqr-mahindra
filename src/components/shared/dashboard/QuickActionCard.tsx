import Link from 'next/link';
import Card from '@/components/shared/layout/Card';

/**
 * Quick Action Card (MSEAL Design Framework, ADR-023, Widget Standard).
 * Every dashboard is a decision center, not a statistics page - this is
 * the "what should the user do next" primitive: a short label, one line
 * of context, and a single destination. Deliberately has no variant for
 * "action with no destination" - a Quick Action always goes somewhere.
 */
export interface QuickActionCardProps {
  icon?: string;
  label: string;
  description?: string;
  href: string;
}

export default function QuickActionCard({ icon, label, description, href }: QuickActionCardProps) {
  return (
    <Link href={href} className="block h-full">
      <Card variant="flat" className="p-4 h-full transition hover:shadow-card-hover hover:border-brand-red/30">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg" aria-hidden="true">{icon}</span>}
          <span className="font-semibold text-brand-dark text-sm">{label}</span>
        </div>
        {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
      </Card>
    </Link>
  );
}
