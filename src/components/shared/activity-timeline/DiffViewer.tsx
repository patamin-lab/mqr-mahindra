'use client';

import { ActivityFieldChange } from './types';

/**
 * "Old → New" field-change list - the Diff Viewer, and also what an
 * expanded `ActivityEventRow` shows for its `changes`. Long text wraps
 * (`break-words`) rather than overflowing, per the spec.
 */
export default function DiffViewer({ changes }: { changes: ActivityFieldChange[] }) {
  return (
    <dl className="space-y-2">
      {changes.map((c, i) => (
        <div key={`${c.fieldName}-${i}`} className="text-sm">
          <dt className="text-xs font-medium text-gray-500">{c.fieldName}</dt>
          <dd className="flex flex-wrap items-start gap-2 mt-0.5">
            <span className="rounded bg-red-50 px-2 py-1 text-red-700 break-words max-w-full">
              {c.oldValue ?? <span className="italic text-gray-400">—</span>}
            </span>
            <span className="text-gray-400 mt-1">↓</span>
            <span className="rounded bg-green-50 px-2 py-1 text-green-700 break-words max-w-full">
              {c.newValue ?? <span className="italic text-gray-400">—</span>}
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
