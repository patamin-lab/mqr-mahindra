/**
 * Architecture Enforcement (docs/engineering/ARCHITECTURE_ENFORCEMENT.md).
 *
 * Static, dependency-free source scan (no bundler/AST needed - a regex
 * scan over import statements is enough for the shape of violation this
 * tool looks for). Run via `npm run architecture`. Exits non-zero if any
 * rule FAILs - safe to wire into CI as a required check.
 *
 * Scope note: "business modules" here means everything under `src/app/`,
 * `src/features/`, `src/components/`, and `src/middleware.ts` - i.e.
 * everything except the platform layer (`src/shared/`) and the
 * infrastructure layer (`src/lib/`), matching
 * `docs/architecture/PLATFORM_CONSTITUTION.md`'s Layer Definitions.
 * Infrastructure files (`src/lib/googleDrive.ts`, `src/lib/supabase.ts`)
 * are the designated place raw SDKs are wrapped - they are correctly
 * exempt from Rule 2, the same way `src/shared/attachments/*Provider.ts`
 * is exempt (it's the platform's own designated SDK-wrapping layer).
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const ATTACHMENTS_DIR = path.join(SRC, 'shared', 'attachments');

type Severity = 'PASS' | 'WARNING' | 'FAIL';

interface RuleResult {
  rule: string;
  severity: Severity;
  details: string[];
}

// ---------------------------------------------------------------------
// File discovery
// ---------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function isTestFile(file: string): boolean {
  return file.includes(`${path.sep}__tests__${path.sep}`) || /\.test\.tsx?$/.test(file);
}

function isBusinessModuleFile(file: string): boolean {
  const rel = path.relative(SRC, file);
  if (rel.startsWith('shared' + path.sep) || rel.startsWith('lib' + path.sep)) return false;
  return (
    rel.startsWith('app' + path.sep) ||
    rel.startsWith('features' + path.sep) ||
    rel.startsWith('components' + path.sep) ||
    rel === 'middleware.ts'
  );
}

function isAttachmentsPlatformFile(file: string): boolean {
  return file.startsWith(ATTACHMENTS_DIR + path.sep) || file === ATTACHMENTS_DIR;
}

function relPath(file: string): string {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

// ---------------------------------------------------------------------
// Import extraction
// ---------------------------------------------------------------------

interface ImportStatement {
  /** The raw text between `import`/`import type` and `from` - e.g.
   *  `{ AttachmentService, AttachmentType }` or `* as attachments`. */
  clause: string;
  /** The module specifier, e.g. `@/shared/attachments`. */
  specifier: string;
}

function extractImports(source: string): ImportStatement[] {
  const imports: ImportStatement[] = [];
  const importRe = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(source))) {
    imports.push({ clause: match[1], specifier: match[2] });
  }
  const requireRe = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((match = requireRe.exec(source))) {
    imports.push({ clause: '', specifier: match[1] });
  }
  return imports;
}

function importsSymbol(clause: string, symbol: string): boolean {
  return new RegExp(`\\b${symbol}\\b`).test(clause);
}

// ---------------------------------------------------------------------
// Rule 1: business modules never import platform internals directly
// ---------------------------------------------------------------------

const FORBIDDEN_PLATFORM_SYMBOLS = [
  'StorageProvider',
  'CloudflareR2Provider',
  'SupabaseStorageProvider',
  'GoogleDriveStorageProvider',
  'StorageProviderFactory',
  'AttachmentRepository',
];

function checkRule1(files: string[]): RuleResult {
  const details: string[] = [];
  for (const file of files) {
    if (!isBusinessModuleFile(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const imp of extractImports(source)) {
      const isAttachmentsBarrel = imp.specifier === '@/shared/attachments';
      const isAttachmentsDeepImport = imp.specifier.startsWith('@/shared/attachments/');
      if (isAttachmentsDeepImport) {
        details.push(`${relPath(file)}: deep-imports "${imp.specifier}" - must import only from the "@/shared/attachments" barrel`);
        continue;
      }
      if (!isAttachmentsBarrel) continue;
      for (const symbol of FORBIDDEN_PLATFORM_SYMBOLS) {
        if (importsSymbol(imp.clause, symbol)) {
          details.push(`${relPath(file)}: imports forbidden platform internal "${symbol}" from "@/shared/attachments"`);
        }
      }
    }
  }
  return { rule: 'Rule 1 - Business modules never import platform internals directly', severity: details.length ? 'FAIL' : 'PASS', details };
}

// ---------------------------------------------------------------------
// Rule 2: business modules never import raw SDKs
// ---------------------------------------------------------------------

const FORBIDDEN_SDK_PATTERNS: { label: string; pattern: RegExp }[] = [
  { label: 'AWS SDK', pattern: /^@aws-sdk\// },
  { label: 'googleapis / google-auth-library', pattern: /^(googleapis|google-auth-library)$/ },
  { label: 'Supabase SDK', pattern: /^@supabase\// },
  { label: 'Cloudflare SDK', pattern: /^@cloudflare\// },
];

function checkRule2(files: string[]): RuleResult {
  const details: string[] = [];
  for (const file of files) {
    if (!isBusinessModuleFile(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const imp of extractImports(source)) {
      const hit = FORBIDDEN_SDK_PATTERNS.find((p) => p.pattern.test(imp.specifier));
      if (hit) details.push(`${relPath(file)}: imports ${hit.label} ("${imp.specifier}") directly - must go through a platform service or src/lib/ infrastructure wrapper`);
    }
  }
  return { rule: 'Rule 2 - Business modules never import raw SDKs', severity: details.length ? 'FAIL' : 'PASS', details };
}

// ---------------------------------------------------------------------
// Rule 3: only AttachmentService (+ the documented operational-surface
// exception) may reference the StorageProvider interface.
//
// docs/architecture/PLATFORM_CONSTITUTION.md's "Platform service
// boundaries" section documents this exception explicitly: the
// maintenance/operational layer (OrphanCleanupService,
// StorageHealthService, StorageScheduler) legitimately reads a
// StorageProvider directly because its job is to detect when the
// service's own invariants have already broken - something
// AttachmentService's own abstraction can't see past. This allowlist is
// that documented exception, not a weakening of the milestone's literal
// "only AttachmentService" wording - a literal single-file rule would
// FAIL already-approved, frozen code from the Storage Operations
// milestone with no real defect behind it.
// ---------------------------------------------------------------------

const PROVIDER_ACCESS_ALLOWLIST = [
  'AttachmentService.ts',
  'StorageProviderFactory.ts',
  'SupabaseStorageProvider.ts',
  'GoogleDriveStorageProvider.ts',
  'CloudflareR2Provider.ts',
  'OrphanCleanupService.ts',
  'StorageHealthService.ts',
  'StorageScheduler.ts',
];

function checkRule3(files: string[]): RuleResult {
  const details: string[] = [];
  for (const file of files) {
    if (!isAttachmentsPlatformFile(file) || isTestFile(file)) continue;
    const basename = path.basename(file);
    if (PROVIDER_ACCESS_ALLOWLIST.includes(basename)) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const imp of extractImports(source)) {
      if (imp.specifier === './StorageProvider' && importsSymbol(imp.clause, 'StorageProvider')) {
        details.push(`${relPath(file)}: references StorageProvider directly - not in the documented allowlist (AttachmentService + the operational-surface exception)`);
      }
    }
  }
  return {
    rule: 'Rule 3 - Only AttachmentService (+ documented operational exception) accesses providers',
    severity: details.length ? 'FAIL' : 'PASS',
    details,
  };
}

// ---------------------------------------------------------------------
// Rule 4: only StorageProviderFactory constructs providers
// ---------------------------------------------------------------------

const CONCRETE_PROVIDER_CLASSES = ['SupabaseStorageProvider', 'GoogleDriveStorageProvider', 'CloudflareR2Provider'];

function checkRule4(files: string[]): RuleResult {
  const details: string[] = [];
  for (const file of files) {
    if (isTestFile(file)) continue;
    if (path.basename(file) === 'StorageProviderFactory.ts') continue;
    // A provider's own file never constructs itself; skip constructor
    // definitions themselves (a class body's own `constructor(...)` is
    // not a `new X(...)` call site).
    const source = fs.readFileSync(file, 'utf8');
    for (const className of CONCRETE_PROVIDER_CLASSES) {
      const re = new RegExp(`new\\s+${className}\\s*\\(`, 'g');
      if (re.test(source)) {
        details.push(`${relPath(file)}: constructs "${className}" directly - only StorageProviderFactory may construct providers`);
      }
    }
  }
  return { rule: 'Rule 4 - Only StorageProviderFactory constructs providers', severity: details.length ? 'FAIL' : 'PASS', details };
}

// ---------------------------------------------------------------------
// Rule 5: no circular dependency inside src/shared/attachments
// ---------------------------------------------------------------------

function resolveRelativeImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [base + '.ts', base + '.tsx', path.join(base, 'index.ts')];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

function checkRule5(files: string[]): RuleResult {
  const platformFiles = files.filter((f) => isAttachmentsPlatformFile(f) && !isTestFile(f));
  const graph = new Map<string, string[]>();
  for (const file of platformFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const deps: string[] = [];
    for (const imp of extractImports(source)) {
      const resolved = resolveRelativeImport(file, imp.specifier);
      if (resolved && platformFiles.includes(resolved)) deps.push(resolved);
    }
    graph.set(file, deps);
  }

  const details: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string, chain: string[]): void {
    if (visiting.has(node)) {
      const cycleStart = chain.indexOf(node);
      const cycle = [...chain.slice(cycleStart), node].map(relPath).join(' -> ');
      details.push(`Circular dependency: ${cycle}`);
      return;
    }
    if (visited.has(node)) return;
    visiting.add(node);
    for (const dep of graph.get(node) ?? []) dfs(dep, [...chain, node]);
    visiting.delete(node);
    visited.add(node);
  }

  for (const file of platformFiles) dfs(file, []);

  return { rule: 'Rule 5 - No circular dependency inside src/shared/attachments', severity: details.length ? 'FAIL' : 'PASS', details };
}

// ---------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------

function printResult(result: RuleResult): void {
  console.log(`\n[${result.severity}] ${result.rule}`);
  for (const detail of result.details) console.log(`  - ${detail}`);
  if (result.details.length === 0) console.log('  (no violations found)');
}

function main(): void {
  const files = walk(SRC);
  const results = [checkRule1(files), checkRule2(files), checkRule3(files), checkRule4(files), checkRule5(files)];

  console.log('Architecture Enforcement Report');
  console.log('================================');
  for (const result of results) printResult(result);

  // Not a numbered validation rule - confirms the CI wiring itself
  // (.github/workflows/ci.yml's "Verify architecture" step) rather than
  // re-checking source code. See docs/engineering/ARCHITECTURE_ENFORCEMENT.md's
  // CI Integration section.
  const ciWorkflowPath = path.join(ROOT, '.github', 'workflows', 'ci.yml');
  const ciWiredIn = fs.existsSync(ciWorkflowPath) && /npm run architecture/.test(fs.readFileSync(ciWorkflowPath, 'utf8'));
  console.log(`\n[${ciWiredIn ? 'PASS' : 'WARNING'}] CI Integration`);
  console.log(
    ciWiredIn
      ? '  - .github/workflows/ci.yml runs "npm run architecture" as a required step'
      : '  - npm run architecture is not yet a required step in .github/workflows/ci.yml'
  );
  console.log('    (see docs/engineering/ARCHITECTURE_ENFORCEMENT.md)');

  const failCount = results.filter((r) => r.severity === 'FAIL').length;
  console.log('\n================================');
  console.log(
    `Summary: ${results.filter((r) => r.severity === 'PASS').length} PASS, ${ciWiredIn ? 0 : 1} WARNING, ${failCount} FAIL (rules 1-5) + CI integration check`
  );

  if (failCount > 0) {
    console.error(`\nArchitecture check FAILED (${failCount} rule(s) with violations).`);
    process.exit(1);
  }
  console.log('\nArchitecture check PASSED.');
}

main();
