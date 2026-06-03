# Expense App Notes

## Session 1 — 2026-02-14

**User goals**
- Target: personal users
- Platform: desktop-based
- Data storage: local file system as backend (avoid storing personal financial data in the cloud)
- No bank aggregation; rely on file imports
- Primary focus: imports, categorization, reconciliation

**User requirements**
- Import bank statements and credit card statements
- Link receipts and sub-items


## Session 1 — Clarifications

**Platform/tech**
- Desktop: Electron

**Imports**
- MVP: CSV + OFX/QFX
- PDF parsing can be later

**Receipts**
- Mobile companion acceptable if it does not store personal info
- If not possible, prefer file import/scanning on desktop

**AI**
- Allowed (local/on-device)


## Session 1 — AI Approach Question

**User question**
- Asked about using ChatGPT/Claude APIs instead of local AI to avoid local model installs.


## Session 1 — Personal Build Direction

**User goal**
- Personal desktop app.
- Drop statements/receipts into a watched folder.
- App imports from folder on open; originals untouched.
- Transactions saved as CSV files for portability.
- Folder is cloud-synced for backup.
- Optional ChatGPT/Claude API key for LLM features.
- Features: import, categorization, reconciliation, receipt linking/splits.


## Session 1 — Import Formats Update

**User update**
- Skip OFX/QFX.
- Support CSV + PDF imports only.


## Session 1 — Full Schema (v1)

**Files**
- Data/transactions/ledger.csv (append-only raw imports)
- Data/transactions/changes.csv (edits, splits, recats, links)
- Data/transactions/transactions.csv (materialized export)
- Data/transactions/import-log.csv (import history)
- Data/receipts/index.csv (receipt index)
- Data/receipts/{receipt_id}.json (receipt detail + line items)
- Data/matches/links.csv (receipt ↔ transaction links)
- Data/rules/categories.csv (category rules)
- Data/index/ledger.sqlite (derived index)

**ledger.csv (raw imports)**
- id (UUID)
- account (text)
- date (YYYY-MM-DD)
- post_date (YYYY-MM-DD, optional)
- description_raw (text)
- merchant_raw (text)
- amount (decimal, signed)
- currency (ISO code)
- source_file (text)
- source_hash (text)
- import_time (ISO timestamp)

**changes.csv (edit log)**
- change_id (UUID)
- transaction_id (UUID)
- change_type (set_category | set_merchant | set_notes | split | link_receipt | unlink_receipt)
- field (optional)
- value (text or JSON string)
- time (ISO timestamp)

**transactions.csv (materialized, export-ready, denormalized)**
- id (UUID)
- parent_id (UUID, optional)
- account
- date
- post_date
- description
- merchant
- amount
- currency
- category
- subcategory
- notes
- receipt_files (semicolon-separated paths)
- line_items (JSON string, optional)
- source_file
- source_hash
- import_time
- confidence (0-1)

**import-log.csv**
- import_id (UUID)
- source_file
- source_hash
- file_type (csv | pdf | image | html)
- imported_at
- rows_imported
- rows_skipped
- notes

**receipts/index.csv**
- receipt_id (UUID)
- file_path
- receipt_type (image | pdf | html | email)
- merchant
- date
- total
- currency
- source_hash
- ocr_status (pending | ok | failed)
- created_at

**receipts/{receipt_id}.json**
- receipt_id
- file_path
- merchant
- date
- total
- currency
- tax
- tip
- confidence
- line_items[]: { line_item_id, description, quantity, unit_price, total, category_hint, confidence }
- raw_text (optional)

**links.csv**
- link_id (UUID)
- transaction_id
- receipt_id
- line_item_id (optional)
- amount
- confidence (0-1)
- notes

**categories.csv (rules)**
- rule_id (UUID)
- match_type (merchant_contains | merchant_regex)
- match_value
- category
- subcategory
- priority (int)
- enabled (true/false)

**SQLite index (derived)**
- Built from ledger.csv + changes.csv + receipts/index.csv
- Used for fast filtering/search


## Session 1 — LLM Export + In-App Q&A

**Request**
- Add LLM export command.
- Support asking questions without leaving the app.

**Notes**
- Provide in-app LLM query panel that builds a filtered export (CSV/Markdown) and sends to selected LLM provider if API key present.
- Keep data minimization + opt-in.
