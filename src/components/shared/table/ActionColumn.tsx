'use client';

import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import ActionButton, { ActionButtonProps } from './ActionButton';
import { resolveActionIcon } from './actionIcons';

/**
 * Platform Action Column (Phase 2 list-page standardization) - the one
 * shared row-actions renderer for every report/list page (View/Edit/
 * Export/Delete), replacing each page's own bespoke action markup.
 * Callers pass only the actions the current role/record state actually
 * permits (via `lib/scope.ts` predicates) - this component never decides
 * permission itself, it only lays out whatever it's given, so an action
 * that would immediately fail is simply never in the list (Mission's
 * "never display actions that immediately fail" rule).
 *
 * Below `sm:` (mobile), all but the first action collapse into a
 * "⋯" overflow menu - a plain-text list, keyboard/click-outside
 * dismissible - so a row with 3-4 icon buttons doesn't overflow a narrow
 * screen.
 */
export type ActionColumnAction = ActionButtonProps & {
  key: string;
};

export default function ActionColumn({ actions }: { actions: ActionColumnAction[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  if (actions.length === 0) return null;

  const [primary, ...rest] = actions;

  return (
    <div className="flex items-center justify-end gap-1">
      {/* Full row on sm+ */}
      <div className="hidden items-center gap-1 sm:flex">
        {actions.map(({ key, ...buttonProps }) => (
          <ActionButton key={key} {...buttonProps} />
        ))}
      </div>

      {/* Collapsed on mobile: primary action + overflow menu for the rest */}
      <div className="flex items-center gap-1 sm:hidden" ref={containerRef}>
        <ActionButton {...primary} />
        {rest.length > 0 && (
          <div className="relative">
            <button
              type="button"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={(e) => {
                e.stopPropagation();
                setOpen((v) => !v);
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition-transform duration-150 hover:scale-110 hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-red"
            >
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
            {open && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-gray-100 bg-white py-1 shadow-card-hover"
                onClick={(e) => e.stopPropagation()}
              >
                {rest.map((action) => {
                  const Icon = resolveActionIcon(action);
                  return (
                    <button
                      key={action.key}
                      type="button"
                      role="menuitem"
                      disabled={action.disabled}
                      onClick={() => {
                        setOpen(false);
                        if (action.href) window.location.href = action.href;
                        else action.onClick?.();
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Icon size={14} aria-hidden="true" />
                      {action.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
