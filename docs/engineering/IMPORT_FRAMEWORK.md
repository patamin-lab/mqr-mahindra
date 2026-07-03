# Universal Import Framework

`src/shared/import/` — the reusable Import Wizard framework every module's bulk/historical-data import is meant to use. NTR Legacy Import is the first, and today only, real consumer; every piece here is generic over a module's own `ImportFieldDefinition[]`, with zero NTR-specific knowledge baked in.

Built in `src/shared/` ahead of a second real consumer existing — a deliberate exception to this repo's own `.claude/rules/01-architecture-boundaries.md` ("shared/ only when at least two modules genuinely need it"), justified because this is framework/infrastructure code, not business logic, and 7 target modules are already named (Vehicle Master, NTR, PM, PDI, MQR, Campaign, Parts). The trade-off: the abstraction is unverified against a second real caller until one of those modules actually adopts it — if it turns out to be the wrong shape, that's the cost of building ahead of evidence.

## Import Wizard (5 steps)

`src/shared/import/components/ImportWizard.tsx` + `StepIndicator.tsx` — a pure UI shell (progress indicator + Card-wrapped content area). It has no upload/parsing/business logic and no knowledge of any module; a module's own page component (`src/features/ntr/components/legacy-import-tool.tsx`) owns all step transitions, API calls, and step content.

1. **Download Template** — `ImportTemplateService.buildImportTemplate()`
2. **Upload File** — drag & drop or file picker; `.xlsx`/`.csv`
3. **Preview & Validation** — counts + column mapping report + per-row reasons, before any database write
4. **Confirm Import** — explicit confirmation screen, not a dialog
5. **Import Complete** — final counts, downloadable result/error CSV, link back to Step 1

## Parser

`ImportParser.ts` (`parseImportFile()`) reads a `.xlsx`/`.csv` down to a header row + raw trimmed-string data rows. This is the "parser logic" the spec says never to modify per module — it has no business field knowledge, handles empty-row skipping, stopping at the last non-empty row, and safely stringifying rich-text/hyperlink/formula-result cells (never falling through to the literal text `"[object Object]"`, the exact defect class the spec called out).

Module-specific type coercion (date/number parsing, enum normalization) is supplied per field via `ImportFieldDefinition.parse`, not hardcoded in the parser.

## Column Mapping

`ColumnMappingService.ts` matches an uploaded file's header row against a module's `ImportFieldDefinition[]` by alias (`HeaderNormalizer.ts` normalizes case/whitespace/separators before comparing), independent of column order. A module lists genuine synonyms only — its own `canonicalKey` and `displayLabel` are always recognized automatically.

```ts
{ canonicalKey: 'dealer_id', displayLabel: 'Dealer Code', required: true, aliases: ['Dealer', 'Dealer_ID', 'DealerCode', 'dealer_code'] }
```

Future modules extend only their own field-definition list — the mapping engine itself is never touched.

## Template Version & Header Validation

`ImportTemplateService.buildImportTemplate()` generates one `.xlsx` with three sheets: **Instructions** (per-column guidance), **Data** (the actual header row to fill in), and **`_META`** (Template Name, Template Version, Module, Generated Date). `ImportTemplateValidator.readTemplateMeta()` reads `_META` back on upload (an absent `_META` — a `.csv`, or a hand-built spreadsheet predating the wizard — is expected, not an error); `validateHeader()` then checks required columns are present via `ColumnMappingService`. Only a missing **required** column blocks import; an absent optional column never does.

## Validation Flow

Upload → generic sheet read → column mapping → per-field coercion → module's own business validation (dealer/master-data lookups, duplicate detection — unchanged, still 100% in `NtrImportService`) → `ImportPreviewBuilder.buildImportSummary()` shapes the counts + per-row outcomes into the `ImportSummary` both Step 3 and Step 5 render. Nothing is written to the database until Step 4's explicit confirmation.

## Error Reporting

`ImportErrorFormatter.ts` rewrites a handful of known technical reason strings (`Unknown dealer_id "X"`, `Missing X`, the duplicate-detection/transactional-race messages) into business-facing language, given a module-supplied `canonicalKey -> displayLabel` map. Anything it doesn't recognize passes through unchanged — a best-effort layer, never lossy. A file that doesn't recognize any of its required columns at all is rejected up front with `formatUnsupportedTemplateMessage()` ("Uploaded file is not a supported import template"), before a session is even created.

## Import History

`ImportHistoryService.ts` is a fan-out/merge layer, not a shared table — each module keeps owning its own session storage (NTR's `ntr_import_sessions` today). A module registers an `ImportHistoryProvider { module, list() }`; `listImportHistory()` merges and sorts whatever providers exist. Today there is exactly one provider (NTR), so the "Module" column in the UI is currently a static `'NTR'` label rather than a real per-row field — this becomes a real per-provider value with zero changes to this file once a second module registers.

## Future Module Integration

To onboard a new module (e.g. Vehicle Master):

1. Define its `ImportFieldDefinition[]` + `ImportTemplateMeta` + instruction text (mirrors `src/features/ntr/services/ntrImportFields.ts`).
2. Reuse `parseImportFile()`/`ColumnMappingService` as-is — do not fork or copy them.
3. Keep all business validation (duplicate detection, master-data lookups) in that module's own service, exactly as `NtrImportService` does — the framework never gains module-specific business logic.
4. Reuse `ImportWizard`/`StepIndicator` for the UI; supply the module's own step content.
5. Register an `ImportHistoryProvider` so its runs appear in the shared Import History view.

Out of scope for this framework (unchanged by this work): NTR's own business rules, Vehicle/NTR record creation, the Timeline/Audit platforms, Google Drive, and the Archive Worker (`NtrImportService.archiveSession()`/`processArchiveQueue()` — see `docs/adr/ADR-008-Google-Drive-Decoupling.md`).
