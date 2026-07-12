import Link from 'next/link';
import { ReactNode } from 'react';

/**
 * Notification Card (MSEAL Design Framework, ADR-023, Widget Standard /
 * NOTIFICATION_GUIDELINE.md). One row in any notification list - Platform,
 * Import, Quality, PM, Warranty, Authentication, or a future AI source.
 * `source` is a short platform-wide vocabulary (not a free-form string) so
 * every consumer renders the same set of visual treatments instead of each
 * module inventing its own.
 */
export type NotificationSource = 'platform' | 'import' | 'quality' | 'pm' | 'warranty' | 'auth' | 'ai';

const SOURCE_STYLE: Record<NotificationSource, { icon: string; colorClassName: string }> = {
  platform: { icon: '🏠', colorClassName: 'bg-gray-100 text-gray-600' },
  import: { icon: '📥', colorClassName: 'bg-blue-100 text-blue-700' },
  quality: { icon: '⚠️', colorClassName: 'bg-red-100 text-red-700' },
  pm: { icon: '🔧', colorClassName: 'bg-teal-100 text-teal-700' },
  warranty: { icon: '🛡️', colorClassName: 'bg-indigo-100 text-indigo-700' },
  auth: { icon: '🔐', colorClassName: 'bg-amber-100 text-amber-700' },
  ai: { icon: '🧠', colorClassName: 'bg-purple-100 text-purple-700' },
};

export interface NotificationCardProps {
  source: NotificationSource;
  title: string;
  message?: string;
  timestamp?: string;
  href?: string;
}

export default function NotificationCard({ source, title, message, timestamp, href }: NotificationCardProps) {
  const style = SOURCE_STYLE[source];
  const body: ReactNode = (
    <div className="flex items-start gap-3 py-2.5 px-1">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${style.colorClassName}`} aria-hidden="true">
        {style.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-brand-dark truncate">{title}</div>
        {message && <div className="text-xs text-gray-500 mt-0.5">{message}</div>}
        {timestamp && <div className="text-[11px] text-gray-400 mt-1">{timestamp}</div>}
      </div>
    </div>
  );
  if (!href) return body;
  return (
    <Link href={href} className="block hover:bg-gray-50 rounded-lg -mx-1">
      {body}
    </Link>
  );
}
