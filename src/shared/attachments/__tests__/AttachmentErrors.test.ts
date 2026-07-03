import { describe, it, expect, vi } from 'vitest';
import { toUserFacingAttachmentError } from '../AttachmentErrors';

describe('toUserFacingAttachmentError', () => {
  it('never leaks the raw error message to the returned string', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = new Error('Google Drive OAuth refresh_token expired for bucket mqr-files');
    const result = toUserFacingAttachmentError(raw, 'upload');
    expect(result).toBe('Upload failed.');
    expect(result).not.toContain('OAuth');
    expect(result).not.toContain('bucket');
  });

  it('returns a distinct message per context', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(toUserFacingAttachmentError(new Error('x'), 'access')).toBe('Attachment is temporarily unavailable.');
    expect(toUserFacingAttachmentError(new Error('x'), 'archive')).toBe('Archive is currently unavailable.');
    expect(toUserFacingAttachmentError(new Error('x'), 'delete')).toBe('Could not delete this attachment.');
    expect(toUserFacingAttachmentError(new Error('x'), 'restore')).toBe('Could not restore this attachment.');
  });
});
