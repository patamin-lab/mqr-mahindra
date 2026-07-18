import { Eye, FileDown, Pencil, Trash2, type LucideIcon } from 'lucide-react';

export type ActionIconName = 'view' | 'edit' | 'export' | 'delete';

export const ACTION_ICONS: Record<ActionIconName, LucideIcon> = {
  view: Eye,
  edit: Pencil,
  export: FileDown,
  delete: Trash2,
};

export type ActionIconProps =
  | { icon: LucideIcon; iconName?: never }
  | { icon?: never; iconName: ActionIconName };

export function resolveActionIcon(action: ActionIconProps): LucideIcon {
  return action.iconName ? ACTION_ICONS[action.iconName] : action.icon!;
}
