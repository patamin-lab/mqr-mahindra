/**
 * Master Data Resolver (Import Platform v2, ADR-022).
 *
 * Formalizes the "ID -> Exact Name -> Alias -> Unique Fuzzy Match"
 * priority the brief asks for, on top of `MasterDataService`'s existing
 * Reference Data Platform reads (`getDealers`/`getBranchesForDealer`/
 * `getActiveProductFamilies`) - never a new query path, and never a
 * write path: this resolver only ever matches against records that
 * already exist. It never creates Dealer/Branch/Product Family rows,
 * by design - a genuinely new dealer/product family is a Master Data
 * management decision for an administrator (`/admin/dealers` etc.),
 * never an automatic side effect of an import.
 *
 * Alias data (a caller's own known synonyms, e.g. "KTV Khon Kaen" ->
 * dealer id "KTV") is supplied by the calling module, exactly like
 * `ImportFieldDefinition.aliases` - this file has no business knowledge
 * of any one module's naming conventions, keeping it reusable across
 * NTR and any future module.
 */
import { getDealers, getBranchesForDealer, getActiveProductFamilies } from './reference/referenceData';
import type { Dealer, Branch, ProductFamily } from '@/lib/types';

export type MasterDataResolutionMethod = 'id' | 'exact_name' | 'alias' | 'fuzzy' | 'ambiguous' | 'not_found';

export interface MasterDataResolution<T> {
  ok: boolean;
  entity: T | null;
  resolutionMethod: MasterDataResolutionMethod;
  confidence: number;
  reason?: string;
}

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Classic edit-distance, no dependency - used only to rank candidates
 *  for the Fuzzy tier, never to accept a match outright (see
 *  `FUZZY_MAX_DISTANCE_RATIO` below for the "unique" requirement). */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

/** A fuzzy candidate must be within 25% edit distance of its own length
 *  AND be the single closest match - two candidates equally close is
 *  "never guess," not "pick the first one." */
const FUZZY_MAX_DISTANCE_RATIO = 0.25;

interface NamedEntity {
  id: string;
  name: string;
}

function resolveGeneric<T extends NamedEntity>(
  candidates: T[],
  rawInput: string,
  aliases?: Record<string, string>
): MasterDataResolution<T> {
  const input = rawInput.trim();
  if (!input) {
    return { ok: false, entity: null, resolutionMethod: 'not_found', confidence: 0, reason: 'No value given' };
  }

  // Tier 1: ID - an exact id match is authoritative, regardless of name.
  const byId = candidates.find((c) => c.id === input);
  if (byId) return { ok: true, entity: byId, resolutionMethod: 'id', confidence: 1 };

  // Tier 2: Exact Name (case/whitespace-insensitive).
  const target = normalizeForMatch(input);
  const byExactName = candidates.filter((c) => normalizeForMatch(c.name) === target);
  if (byExactName.length === 1) return { ok: true, entity: byExactName[0], resolutionMethod: 'exact_name', confidence: 1 };
  if (byExactName.length > 1) {
    return { ok: false, entity: null, resolutionMethod: 'ambiguous', confidence: 0, reason: `"${input}" matches ${byExactName.length} records by name` };
  }

  // Tier 3: Alias - caller-supplied synonym map, canonical id on the right.
  if (aliases) {
    const aliasEntry = Object.entries(aliases).find(([alias]) => normalizeForMatch(alias) === target);
    if (aliasEntry) {
      const [, canonicalId] = aliasEntry;
      const match = candidates.find((c) => c.id === canonicalId);
      if (match) return { ok: true, entity: match, resolutionMethod: 'alias', confidence: 0.95 };
    }
  }

  // Tier 4: Unique Fuzzy Match - only accepted if exactly one candidate
  // is close enough, never the "best of several roughly-equal" guesses.
  const scored = candidates
    .map((c) => ({ candidate: c, distance: levenshtein(target, normalizeForMatch(c.name)) }))
    .filter((s) => s.distance <= Math.ceil(Math.max(target.length, s.candidate.name.length) * FUZZY_MAX_DISTANCE_RATIO))
    .sort((a, b) => a.distance - b.distance);
  if (scored.length === 1 || (scored.length > 1 && scored[0].distance < scored[1].distance)) {
    const best = scored[0];
    return { ok: true, entity: best.candidate, resolutionMethod: 'fuzzy', confidence: 1 - best.distance / Math.max(target.length, 1) };
  }
  if (scored.length > 1) {
    return { ok: false, entity: null, resolutionMethod: 'ambiguous', confidence: 0, reason: `"${input}" fuzzy-matches ${scored.length} records equally closely` };
  }

  return { ok: false, entity: null, resolutionMethod: 'not_found', confidence: 0, reason: `"${input}" does not match any known record` };
}

export async function resolveDealer(input: string, aliases?: Record<string, string>): Promise<MasterDataResolution<Dealer>> {
  const dealers = await getDealers();
  return resolveGeneric(
    dealers.map((d) => ({ ...d, name: d.full_name || d.short_name, id: d.id })),
    input,
    aliases
  ) as MasterDataResolution<Dealer>;
}

export async function resolveBranch(dealerId: string | null, input: string, aliases?: Record<string, string>): Promise<MasterDataResolution<Branch>> {
  const branches = await getBranchesForDealer(dealerId);
  return resolveGeneric(
    branches.map((b) => ({ ...b, name: b.name, id: b.id })),
    input,
    aliases
  ) as MasterDataResolution<Branch>;
}

export async function resolveProductFamily(input: string, aliases?: Record<string, string>): Promise<MasterDataResolution<ProductFamily>> {
  const families = await getActiveProductFamilies();
  return resolveGeneric(
    families.map((f) => ({ ...f, name: f.name, id: f.id })),
    input,
    aliases
  ) as MasterDataResolution<ProductFamily>;
}
