/**
 * Single source of truth for platform branding (Option A rebrand: the
 * legacy "MASP" identifier -> "MSEAL DMS", confirmed with the user).
 * Every UI surface, generated-file metadata, and downloaded filename that
 * shows the platform's own name imports `APP_NAME` from here instead of
 * repeating the literal string - a future rename is a one-line change,
 * not a repo-wide find/replace.
 *
 * Never import this for the MQR/PM/NTR module names, business document
 * titles, or record ID formats - those are business terminology, not
 * platform branding, and stay exactly as they are.
 */
export const APP_NAME = 'MSEAL DMS';

/**
 * No real build/version source exists yet: `package.json`'s `"version":
 * "0.1.0"` has never been bumped and isn't wired to anything (confirmed
 * by grepping for any reader of it) - the real release history is
 * tracked entirely via git tags (v1.0.0 through v2.4.0-foundation) and
 * commit SHAs, never surfaced to the running app at build time. This
 * constant preserves the exact value already shown before this rebrand
 * ("MASP v1.1" -> "MSEAL DMS v1.1") rather than inventing a new one.
 *
 * Remaining technical debt: wire this to a real source - e.g. inject
 * Vercel's `VERCEL_GIT_COMMIT_SHA`/the latest git tag at build time via
 * a `NEXT_PUBLIC_APP_VERSION` env var, or start actually bumping
 * `package.json`'s version in step with releases and read it from there.
 * Not done here - out of scope for a branding-only PR, and doing it
 * properly deserves its own small, deliberate change (build-time env
 * injection touches `next.config.js`, is worth its own verification).
 */
export const APP_VERSION = 'v1.1';
