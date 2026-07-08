'use client';

/**
 * The ONE shared Notification control - currently a disabled placeholder
 * (no notification backend/event source exists yet), extracted out of
 * `PlatformHeader` so any future notification feature has exactly one
 * bell icon to wire real behavior into, rather than a second one being
 * added inline somewhere else.
 */
export interface NotificationBellProps {
  label: string;
  comingSoonLabel: string;
  className?: string;
}

export default function NotificationBell({ label, comingSoonLabel, className }: NotificationBellProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled
      title={comingSoonLabel}
      className={`p-2 rounded-full text-white/50 cursor-not-allowed ${className ?? ''}`}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .53-.21 1.04-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    </button>
  );
}
