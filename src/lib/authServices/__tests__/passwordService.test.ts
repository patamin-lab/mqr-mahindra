import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sha256Hex } from '../../auth';
import {
  hashPassword,
  isPasswordExpired,
  isWithinMinimumAge,
  validateComplexity,
  verifyPassword,
} from '../passwordService';

describe('validateComplexity', () => {
  it('rejects a password under 8 characters', () => {
    expect(validateComplexity('Ab1')).toMatch(/8 ตัวอักษร/);
  });
  it('rejects a password with no letters', () => {
    expect(validateComplexity('12345678')).toMatch(/ตัวอักษร/);
  });
  it('rejects a password with no numbers', () => {
    expect(validateComplexity('abcdefgh')).toMatch(/ตัวเลข/);
  });
  it('accepts a password with 8+ chars, a letter, and a number', () => {
    expect(validateComplexity('Abcdef12')).toBeNull();
  });
});

describe('hashPassword / verifyPassword (scrypt)', () => {
  it('a hashed password verifies against the correct plaintext', async () => {
    const { hash, salt } = await hashPassword('CorrectHorse123');
    const stored = { password_hash: hash, password_salt: salt, password_algo: 'scrypt' };
    expect(await verifyPassword('CorrectHorse123', stored)).toBe(true);
  });

  it('a hashed password does not verify against the wrong plaintext', async () => {
    const { hash, salt } = await hashPassword('CorrectHorse123');
    const stored = { password_hash: hash, password_salt: salt, password_algo: 'scrypt' };
    expect(await verifyPassword('WrongPassword99', stored)).toBe(false);
  });

  it('two hashes of the same password are never identical (random salt per hash)', async () => {
    const a = await hashPassword('SamePassword1');
    const b = await hashPassword('SamePassword1');
    expect(a.hash).not.toBe(b.hash);
    expect(a.salt).not.toBe(b.salt);
  });
});

describe('verifyPassword — legacy sha256 fallback', () => {
  it('verifies a legacy (password_algo !== "scrypt") row via sha256Hex, matching lib/auth.ts', async () => {
    const legacyHash = await sha256Hex('LegacyPassword1');
    const stored = { password_hash: legacyHash, password_salt: null, password_algo: 'sha256' };
    expect(await verifyPassword('LegacyPassword1', stored)).toBe(true);
    expect(await verifyPassword('WrongPassword', stored)).toBe(false);
  });
});

describe('isWithinMinimumAge / isPasswordExpired — disabled by default', () => {
  it('always returns false when the corresponding env var is unset (0 = no limit)', () => {
    expect(isWithinMinimumAge(new Date().toISOString())).toBe(false);
    expect(isPasswordExpired(new Date(0).toISOString())).toBe(false);
  });
  it('returns false for a null password_changed_at regardless of config', () => {
    expect(isWithinMinimumAge(null)).toBe(false);
    expect(isPasswordExpired(null)).toBe(false);
  });
});

describe('isWithinMinimumAge / isPasswordExpired — enabled via env var', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('isWithinMinimumAge blocks a change within the configured window once PASSWORD_MIN_AGE_HOURS is set', async () => {
    process.env.PASSWORD_MIN_AGE_HOURS = '24';
    const { isWithinMinimumAge: isWithinMinimumAgeEnabled } = await import('../passwordService');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(isWithinMinimumAgeEnabled(oneHourAgo)).toBe(true);
    expect(isWithinMinimumAgeEnabled(twoDaysAgo)).toBe(false);
    delete process.env.PASSWORD_MIN_AGE_HOURS;
  });

  it('isPasswordExpired flags a password older than PASSWORD_EXPIRY_DAYS once set', async () => {
    process.env.PASSWORD_EXPIRY_DAYS = '90';
    const { isPasswordExpired: isPasswordExpiredEnabled } = await import('../passwordService');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const hundredDaysAgo = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
    expect(isPasswordExpiredEnabled(yesterday)).toBe(false);
    expect(isPasswordExpiredEnabled(hundredDaysAgo)).toBe(true);
    delete process.env.PASSWORD_EXPIRY_DAYS;
  });
});
