# Transactions Page — Scope of Work (v1)

## Purpose
Provide a fast, reliable view of imported transactions that supports filtering, categorization, receipt linking, and reconciliation actions without leaving the page.

## Core User Goals
- See all transactions (materialized view).
- Quickly find and filter transactions.
- Edit category/merchant/notes inline.
- Link or split transactions to receipts.
- Identify exceptions (uncategorized, unmatched, duplicates).

## Data Sources
- `Data/transactions/transactions.csv` (primary list)
- `Data/receipts/index.csv` (receipt metadata)
- `Data/matches/links.csv` (existing links)
- `Data/transactions/changes.csv` (edits/splits)

## Functional Scope

### 1) Table View
- Display transactions in a sortable, scrollable table.
- Columns (default):
  - date, merchant, amount, category, subcategory, account, notes, receipt_files
- Sticky header and column resize.
- Row selection (single + multi-select).
- Per-column filter controls (inline).

### 2) Filters & Search
- Global search: merchant, description, notes.
- Column filters (quick): date, amount, category, account, receipt status.
- Advanced filtering (multi-rule):
  - Date range
  - Category/subcategory
  - Account
  - Amount range
  - Has receipt (yes/no)
  - Uncategorized
  - Unmatched
  - Merchant contains / regex
  - Notes contains
- Saved filter presets (local).

### 3) Inline Editing
- Edit category/subcategory via dropdown (supports free text).
- Edit merchant and notes inline.
- Changes write to `changes.csv` (not direct edits to ledger).
- Multi-edit:
  - Apply category/merchant/notes to selected rows.
  - Confirm before applying to N rows.

### 4) Receipt Linking
- Show receipt status indicator per row.
- Link receipts to a transaction (manual select from `receipts/index.csv`).
- Unlink receipts from a transaction.
- Link to specific receipt line item (if available).

### 5) Splits
- Split transaction into multiple child rows.
- Each child can have:
  - amount, category, notes, receipt line item
- Split creates `change_type=split` in `changes.csv`.

### 6) Reconciliation Helpers
- Highlight potential duplicates (same amount/date/merchant).
- Highlight low-confidence categories.
- Quick action: “Mark reviewed”.

### 7) Import Feedback
- Show import source (file name + import date).
- Quick link to “Import Log” for troubleshooting.

### 8) Export (Optional Shortcut)
- Export current filtered view to CSV or Markdown (LLM export).

## Non-Goals (v1)
- Multi-user collaboration
- Bank aggregation
- Real-time folder watch
- Complex budgeting charts

## Performance Notes
- Use SQLite index for filtering/sorting.
- Virtualized table for large datasets.

## Error Handling
- Missing receipts: show warning badge.
- Corrupt CSV rows: skip with error entry in import log.

## UX Notes
- Default view shows last 90 days.
- Exceptions panel (uncategorized, unmatched) as a side summary.
