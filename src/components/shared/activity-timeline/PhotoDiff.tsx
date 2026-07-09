'use client';

import { ActivityPhotoChange } from './types';

/**
 * Old → New photo thumbnails for a "Photos Updated" event. Thumbnail
 * preview only, per the spec - clicking through to the full photo is
 * already covered by the Photos/Video section's own gallery (Quick
 * Navigation scrolls there for exactly this reason).
 *
 * Note: `removed`/`added` are shown as two groups, not paired 1:1 by
 * category - the underlying audit log doesn't record which specific
 * category a removed photo belonged to (see `mapAuditLogToActivityEvents.ts`'s
 * doc comment), so an edit that replaces more than one photo can't be
 * matched exactly "this old one became this new one." Documented as a
 * known limitation, not a bug.
 */
export default function PhotoDiff({ photoChanges, removedLabel, addedLabel }: { photoChanges: ActivityPhotoChange[]; removedLabel: string; addedLabel: string }) {
  const removed = photoChanges.filter((p) => p.action === 'removed');
  const added = photoChanges.filter((p) => p.action === 'added');

  return (
    <div className="flex flex-wrap items-start gap-4">
      {removed.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">{removedLabel}</div>
          <div className="flex flex-wrap gap-2">
            {removed.map((p, i) => (
              <img key={`${p.url}-${i}`} src={p.url} alt={p.label} className="h-16 w-16 rounded border border-gray-200 object-cover opacity-60" />
            ))}
          </div>
        </div>
      )}
      {removed.length > 0 && added.length > 0 && <span className="text-gray-400 mt-6">→</span>}
      {added.length > 0 && (
        <div>
          <div className="text-xs font-medium text-gray-500 mb-1">{addedLabel}</div>
          <div className="flex flex-wrap gap-2">
            {added.map((p, i) => (
              <img key={`${p.url}-${i}`} src={p.url} alt={p.label} className="h-16 w-16 rounded border border-gray-200 object-cover" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
