'use client';

/**
 * Machine Digital Passport v1.1 refinement - Timeline filtering for the
 * Lifecycle section's milestone timeline. Deliberately does NOT
 * reimplement or wrap a second timeline renderer: the server renders the
 * exact same `Timeline`/`MachineTimelineRow` rows it always has (each one
 * tagged with a `data-category` attribute) and passes that already-
 * rendered JSX in as `children` - this component only toggles which rows
 * are visible, via a plain DOM effect, matching the CSS-driven visibility
 * approach used because `MachineTimelineRow` renders through the
 * server-only `lib/i18n/server` translator and can't be re-rendered
 * client-side without duplicating it (which "no duplicate timeline"
 * rules out). No new state library, no new dependency.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n/LocaleProvider';

export type TimelineFilterCategory = 'all' | 'ntr' | 'pm' | 'mqr' | 'other';

const CATEGORIES: { key: TimelineFilterCategory; labelKey: string }[] = [
  { key: 'all', labelKey: 'machinePassport.timelineFilterAll' },
  { key: 'ntr', labelKey: 'machinePassport.timelineFilterNtr' },
  { key: 'pm', labelKey: 'machinePassport.timelineFilterPm' },
  { key: 'mqr', labelKey: 'machinePassport.timelineFilterMqr' },
  { key: 'other', labelKey: 'machinePassport.timelineFilterOther' },
];

export default function MachineTimelineFilterBar({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [active, setActive] = useState<TimelineFilterCategory>('all');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const rows = listRef.current?.querySelectorAll<HTMLElement>('[data-category]') ?? [];
    rows.forEach((row) => {
      row.style.display = active === 'all' || row.dataset.category === active ? '' : 'none';
    });
  }, [active, children]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setActive(c.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              active === c.key ? 'bg-brand-dark text-white border-brand-dark' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t(c.labelKey)}
          </button>
        ))}
      </div>
      <div ref={listRef}>{children}</div>
    </div>
  );
}
