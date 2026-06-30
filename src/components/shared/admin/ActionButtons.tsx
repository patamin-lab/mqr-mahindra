'use client';

import { ReactNode } from 'react';

/**
 * Shared row-action button cluster for admin CRUD tables: edit / save / cancel,
 * plus the active-toggle button. Matches the exact markup + classNames that
 * were duplicated across dealers-table.tsx, branches-table.tsx,
 * technicians-table.tsx, users-table.tsx and problem-codes-table.tsx.
 *
 * Entity-specific extra buttons (e.g. Users' "reset password" / "delete")
 * are passed in via `extra` rather than baked into this component, so this
 * stays a faithful extraction of only the behavior that was truly identical.
 */
export type ActionButtonsProps = {
  editing: boolean;
  busy: boolean;
  active: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onToggleActive: () => void;
  editLabel?: string;
  saveLabel?: string;
  cancelLabel?: string;
  deactivateLabel?: string;
  activateLabel?: string;
  extra?: ReactNode;
};

export default function ActionButtons({
  editing,
  busy,
  active,
  onEdit,
  onSave,
  onCancel,
  onToggleActive,
  editLabel = 'แก้ไข',
  saveLabel = 'บันทึก',
  cancelLabel = 'ยกเลิก',
  deactivateLabel = 'ปิดใช้งาน',
  activateLabel = 'เปิดใช้งาน',
  extra,
}: ActionButtonsProps) {
  if (editing) {
    return (
      <>
        <button disabled={busy} onClick={onSave} className="text-brand-red text-xs font-medium">
          {saveLabel}
        </button>
        <button onClick={onCancel} className="text-gray-400 text-xs">
          {cancelLabel}
        </button>
      </>
    );
  }

  return (
    <>
      <button onClick={onEdit} className="text-blue-600 text-xs font-medium">
        {editLabel}
      </button>
      <button disabled={busy} onClick={onToggleActive} className="text-gray-500 text-xs">
        {active ? deactivateLabel : activateLabel}
      </button>
      {extra}
    </>
  );
}
