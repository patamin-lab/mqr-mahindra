# NTR Legacy Import — Template Manual

How to prepare a historical-data file for the NTR Legacy Import tool
(`/admin/legacy-import`, Super Administrator only). This is the short
operator-facing quick reference - see
`docs/import/NTR_HISTORICAL_IMPORT.md` for full detail (address
validation, Serial Number modes, duplicate detection, date validation,
transaction strategy, audit log, error messages). Read alongside
`docs/standards/MODULE_DEVELOPMENT_STANDARD.md` and the tool's own code
(`src/features/ntr/services/ntrImportFields.ts`), which is the actual
source of truth for the field/alias list if this document ever drifts
from it.

## File format

`.xlsx` or `.csv`. The first row is the header row and is not itself
imported — data starts on row 2. **Columns are matched by header
name/alias, not position** - a file with reordered columns or a
recognized synonym header (e.g. "Zip Code" for Postal Code) still parses
correctly, via `ColumnMappingService`. The table below still reflects
the template's own default column order (and is what the downloadable
template ships with), but a dealer's existing export does not need to
match it exactly:

| # | Column | Required? | Notes |
|---|---|---|---|
| 1 | `dealer_id` | **Required** | Must match an existing Dealer Code exactly |
| 2 | `branch_id` | Optional | Branch UUID, if known |
| 3 | `serial` | **Required** | Tractor serial number — if no matching `vehicles` row exists, one is created automatically |
| 4 | `model` | Optional | |
| 5 | `engine_number` | **Required** | |
| 6 | `customer_name` | **Required*** | *Not required if `customer_first_name`/`customer_last_name` (columns 18–19) are filled instead — see below |
| 7 | `customer_phone` | **Required** | Thai mobile format, 10 digits starting with 0 |
| 8 | `customer_address` | Optional | |
| 9 | `customer_district` | Optional | |
| 10 | `customer_province` | Optional | |
| 11 | `customer_postal_code` | Optional | |
| 12 | `customer_type` | Optional | `Individual` / `Company` (or Thai `บุคคลธรรมดา` / `นิติบุคคล`) |
| 13 | `retail_date` | Optional | ISO `YYYY-MM-DD` |
| 14 | `delivery_date` | **Required** | ISO `YYYY-MM-DD` — this is the Acceptance Date (see `docs/standards/DOMAIN_LANGUAGE_STANDARD.md`'s Retail Date vs. Acceptance Date note), not "Retail Date" |
| 15 | `salesperson` | Optional | |
| 16 | `receiving_person` | Optional | |
| 17 | `hour_meter` | Optional | Numeric |
| 18 | `customer_title` | Optional | Added in Release v1.1 |
| 19 | `customer_first_name` | Optional | Added in Release v1.1 |
| 20 | `customer_last_name` | Optional | Added in Release v1.1 |
| 21 | `customer_subdistrict` | Optional | Added in Release v1.1 |
| 22 | `product_family_id` | Optional | Added in Release v1.1 — Product Family UUID (must reference an existing, active Product Family) |
| 23 | `variant` | Optional | Added in Release v1.1 — free text |
| 24 | `pdi_date` | Optional | Added in Release v1.1 — ISO `YYYY-MM-DD` |
| 25 | `manufacturing_year` | Optional | Added in Release v1.1 — 4-digit year |

**A legacy file exported before Release v1.1 (only 17 columns) still
imports correctly** — columns 18–25 are appended at the end, not
inserted in the middle, specifically so older files don't need their
existing columns reordered. Missing trailing columns are simply left
`NULL` on the resulting record, never rejected.

## Customer name: two ways to provide it

Either fill column 6 (`customer_name`) directly, or fill columns 18–20
(`customer_title`/`customer_first_name`/`customer_last_name`) and leave
column 6 blank — the import composes `customer_name` from the
structured fields automatically (same rule the manual registration form
uses, see `docs/standards/DATABASE_STANDARD.md`'s "avoid storing
duplicate business data"). Do not fill both inconsistently; if column 6
is non-empty, it wins.

## Validation (Preview step)

Every row is checked before anything is imported:

- **Required fields** (`dealer_id`, `serial`, `engine_number`,
  `delivery_date`, `customer_name`-or-structured-name, `customer_phone`)
  — missing any marks the row **Failed**. `retail_date` is optional, same
  as the manual registration form.
- **Dealer must exist** — an unrecognized `dealer_id` marks the row
  **Failed**.
- **Duplicate detection** — a `serial` that already has an active NTR on
  file marks the row **Duplicate**, not re-imported.
- **Empty row** (every key field blank) is marked **Skipped**, not
  Failed — distinguishing a genuinely malformed row from a blank
  spreadsheet row left over from formatting.

Nothing is written to the database during Preview. Only after reviewing
the counts and clicking **Import** does `commit()` re-fetch and
re-validate the stored file and actually write rows — see
`src/features/ntr/services/ntrImportService.ts`'s header comment for why
it re-validates rather than trusting the preview's row list.

## Product Family reference

Column 22 (`product_family_id`) must be an existing Product Family's
UUID, not a free-text name — this column resolves to master data
(`product_families`), it never creates a new Product Family. Look up the
correct UUID via the Product Family admin page
(`/admin/product-families`) before preparing the import file. A value
that doesn't match any Product Family is simply left `NULL` on the
resulting record (not a validation failure) — the record still imports,
just without a resolved Product Family until corrected manually.

## Verification

This document was updated (parsing-method description corrected;
pointer to `docs/import/NTR_HISTORICAL_IMPORT.md` added) as part of the
NTR Historical Import Framework enhancement, which did modify the
import tool - see that document for exactly what changed (address
validation, Serial Number import modes, duplicate detection, date
validation, `NTR_IMPORT_RESULT.xlsx`).
