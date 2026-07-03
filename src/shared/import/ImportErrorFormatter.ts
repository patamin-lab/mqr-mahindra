/**
 * Universal Import Framework — humanized error messages (Step 3/Step 5).
 *
 * Business validation still raises precise, technical reasons internally
 * (e.g. `Unknown dealer_id "D9"`) - this layer rewrites the ones a
 * business user (a dealer's admin staff, not an engineer) would otherwise
 * see verbatim, into plain language, without changing what actually failed
 * validation. A module supplies its own field-name -> business-label map;
 * this file has no hardcoded field names.
 */

export interface ImportErrorFormatterOptions {
  /** Canonical field key -> the business-facing column name to mention in
   *  a rewritten message (e.g. `dealer_id` -> "Dealer Code"). */
  fieldLabels: Record<string, string>;
}

const PATTERNS: { test: RegExp; rewrite: (match: RegExpMatchArray, labels: Record<string, string>) => string }[] = [
  {
    test: /^Unknown (\w+) "(.*)"$/,
    rewrite: (m, labels) => `${labels[m[1]] ?? m[1]} column contains an invalid value: "${m[2]}".`,
  },
  {
    test: /^Missing (\w+)$/,
    rewrite: (m, labels) => `${labels[m[1]] ?? m[1]} is required but was left blank.`,
  },
  {
    test: /^Missing customer name \(or title\/first\/last name\) or customer_phone$/,
    rewrite: () => 'Customer Name (or Title/First/Last Name) and Customer Phone are required.',
  },
  {
    test: /^Already registered as (.+)$/,
    rewrite: (m) => `This tractor is already registered (${m[1]}).`,
  },
  {
    test: /^DUPLICATE_NTR: tractor serial (.+) is already registered$/,
    rewrite: (m) => `Tractor serial ${m[1]} was registered by another import or user just before this one completed.`,
  },
];

/** Rewrites one technical reason string into a business-facing message.
 *  Falls back to the original text, unchanged, when no pattern matches -
 *  this is a best-effort humanization layer, never a lossy one. */
export function formatImportError(technicalMessage: string, options: ImportErrorFormatterOptions): string {
  for (const pattern of PATTERNS) {
    const match = technicalMessage.match(pattern.test);
    if (match) return pattern.rewrite(match, options.fieldLabels);
  }
  return technicalMessage;
}

/** For a file that fails Header Validation entirely (missing required
 *  columns, or isn't a recognizable spreadsheet at all) - Step 2/3's
 *  top-level rejection message rather than a per-row reason. */
export function formatUnsupportedTemplateMessage(): string {
  return 'Uploaded file is not a supported import template.';
}
