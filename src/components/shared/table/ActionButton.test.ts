import { describe, expect, it } from 'vitest';
import { Eye } from 'lucide-react';
import { ACTION_ICONS, resolveActionIcon } from './actionIcons';

describe('ActionButton icon resolution', () => {
  it('resolves serializable icon names for server-to-client actions', () => {
    expect(resolveActionIcon({ iconName: 'view' })).toBe(ACTION_ICONS.view);
  });

  it('preserves direct icon components for client-only callers', () => {
    expect(resolveActionIcon({ icon: Eye })).toBe(Eye);
  });
});
