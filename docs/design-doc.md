# Genzeb — Design Doc (v1)

## Summary
A personal, local‑first desktop expense workspace that ingests bank/credit card statements and receipts from a watched folder, stores transactions as portable CSV, and supports categorization, reconciliation, and receipt linking. Optional LLM features are opt‑in via user‑provided API keys. All data lives in a cloud‑syncable folder.

## Goals
- Local‑first, privacy‑preserving data storage.
- Statement import via CSV (PDF parsing deferred).
- Receipt ingestion (images + digital receipts).
- Append‑only raw ledger + change log + materialized export.
- Fast filtering/search via derived SQLite index.
- In‑app reconciliation and receipt linking.
- Optional in‑app LLM Q&A with data minimization.

## Non‑Goals (v1)
- Bank aggregation (Plaid/Finicity/etc.).
- Multi‑user or team workflows.
- Real‑time folder watching (scan on open + manual refresh only).
- Full budgeting and forecasting dashboards.

## Target Users
- Individual/personal users who want local control and portability.

## User Workflow
1. Drop statements/receipts into `Inbox/`.
2. Open app and click Refresh (or auto scan on open).
3. Import pipeline parses CSV statements, copies receipts.
4. Transactions materialized into `transactions.csv`.
5. User categorizes, links receipts, and splits transactions.
6. Optional LLM Q&A over filtered exports.

## System Architecture

### High‑Level Components
- **Importer**: CSV parsing, file hashing, dedupe, append to `ledger.csv`.
- **Ledger**: append‑only raw log + `changes.csv` edit log.
- **Materializer**: builds `transactions.csv` and updates SQLite index.
- **Receipts**: ingestion, OCR, line‑item parsing.
- **Rules**: categorization engine and persistence.
- **Reconciliation**: linking receipts, splits, exceptions.
- **LLM**: export + in‑app Q&A (OpenAI/Anthropic, opt‑in).
- **UI (Electron)**: Transactions, Receipts, Reconcile, Ask, Settings.

### Local Data Layout (Cloud‑syncable)
```
Inbox/
Data/
  transactions/
    ledger.csv
    changes.csv
    transactions.csv
    import-log.csv
  receipts/
    index.csv
    <receipt_id>.json
  matches/
    links.csv
  rules/
    categories.csv
  index/
    ledger.sqlite
Exports/
  llm/
```

## Data Model

### Append‑Only Ledger
- `ledger.csv`: raw imports only, never edited.
- `changes.csv`: all user edits and splits.
- `transactions.csv`: denormalized export view.

### Receipts
- `receipts/index.csv`: receipt metadata, type and status.
- `receipts/{id}.json`: OCR + line items.

### Links
- `matches/links.csv`: transaction ↔ receipt links.

### Rules
- `rules/categories.csv`: merchant/category rules.

## Detailed Schemas (v1)

### `Data/transactions/ledger.csv`
- `id` (UUID)
- `account` (text)
- `date` (YYYY‑MM‑DD)
- `post_date` (YYYY‑MM‑DD, optional)
- `description_raw` (text)
- `merchant_raw` (text)
- `amount` (decimal, signed)
- `currency` (ISO code)
- `source_file` (text)
- `source_hash` (text)
- `import_time` (ISO timestamp)

### `Data/transactions/changes.csv`
- `change_id` (UUID)
- `transaction_id` (UUID)
- `change_type` (`set_category` | `set_merchant` | `set_notes` | `split` | `link_receipt` | `unlink_receipt`)
- `field` (optional)
- `value` (text or JSON string)
- `time` (ISO timestamp)

### `Data/transactions/transactions.csv` (materialized export)
- `id` (UUID)
- `parent_id` (UUID, optional)
- `account`
- `date`
- `post_date`
- `description`
- `merchant`
- `amount`
- `currency`
- `category`
- `subcategory`
- `notes`
- `receipt_files` (semicolon‑separated paths)
- `line_items` (JSON string, optional)
- `source_file`
- `source_hash`
- `import_time`
- `confidence` (0–1)

### `Data/transactions/import-log.csv`
- `import_id` (UUID)
- `source_file`
- `source_hash`
- `file_type` (`csv` | `pdf` | `image` | `html`)
- `imported_at`
- `rows_imported`
- `rows_skipped`
- `notes`

### `Data/receipts/index.csv`
- `receipt_id` (UUID)
- `file_path`
- `receipt_type` (`image` | `pdf` | `html` | `email`)
- `merchant`
- `date`
- `total`
- `currency`
- `source_hash`
- `ocr_status` (`pending` | `ok` | `failed`)
- `created_at`

### `Data/receipts/{receipt_id}.json`
- `receipt_id`
- `file_path`
- `merchant`
- `date`
- `total`
- `currency`
- `tax`
- `tip`
- `confidence`
- `line_items[]`: `{ line_item_id, description, quantity, unit_price, total, category_hint, confidence }`
- `raw_text` (optional)

### `Data/matches/links.csv`
- `link_id` (UUID)
- `transaction_id`
- `receipt_id`
- `line_item_id` (optional)
- `amount`
- `confidence` (0–1)
- `notes`

### `Data/rules/categories.csv`
- `rule_id` (UUID)
- `match_type` (`merchant_contains` | `merchant_regex`)
- `match_value`
- `category`
- `subcategory`
- `priority` (int)
- `enabled` (true/false)

## Materialization Rules (Summary)
- Apply `changes.csv` in time order over `ledger.csv`.
- `set_*` changes overwrite fields in the materialized view.
- `split` generates child rows with `parent_id`; parent omitted unless flagged.
- Receipt links populate `receipt_files` and optional `line_items`.

## LLM Q&A (Deferred)
- Not in v1. Keep LLM export only for external tools.
- Optional API key support remains for OCR parsing and enrichment.

## OCR Strategy (Hybrid)
- Default: local OCR for privacy (no images leave device).
- Optional per‑receipt toggle: LLM Vision OCR for higher accuracy.
- LLM OCR uses user‑provided API key and explicit opt‑in per file.
- LLM OCR output is stored the same as local OCR results.

## UI Surfaces
- **Transactions**: table view, inline edits, multi‑edit, filters.
- **Receipts**: list + viewer, OCR status.
- **Reconcile**: match suggestions, manual linking, splits.
- **Ask**: LLM Q&A interface.
- **Settings**: data folder, API keys, preferences.

## Import & Dedupe Strategy
- Hash files on import; store `source_hash`.
- Deduplicate by `(source_hash, date, amount, merchant)`.
- Import log for diagnostics.

## Performance
- Use SQLite index for filtering/sorting.
- Virtualized tables for large datasets.

## Privacy & Security
- All data stored locally in user‑selected folder.
- Optional LLM calls are opt‑in with explicit user control.
- API keys stored locally; encryption recommended.

## Risks & Mitigations
- **CSV variability**: require mapping templates or user column mapping.
- **OCR accuracy**: keep manual correction flow.
- **Cloud‑sync conflicts**: rely on append‑only logs; rebuild materialized view.

## Milestones (MVP)
1. Import CSV statements → `ledger.csv` + `import-log.csv`.
2. Materializer → `transactions.csv` + SQLite index.
3. Transactions UI (view + inline edit + filters).
4. Receipt ingestion + OCR.
5. Reconciliation (link/split).
6. LLM export + in‑app Q&A.

## Error Handling (v1)

### Import Errors
- **Malformed CSV**: show row‑level error count and line numbers; skip bad rows; log in `import-log.csv`.
- **Unknown headers**: prompt for column mapping; save mapping per bank.
- **Duplicate import**: detect via `source_hash`; mark as skipped in `import-log.csv`.
- **File lock/permission**: show actionable message and retry option.

### Receipt Errors
- **OCR failed**: mark `ocr_status=failed` and allow manual retry.
- **Unsupported file type**: show in import summary; keep file in Inbox.
- **Corrupt image/PDF**: mark error and skip OCR; allow manual link.

### Materialization Errors
- **Missing referenced receipt**: show warning badge on transaction; log event.
- **Invalid split payload**: skip split and show error in changes log view.

### LLM Errors
- **Missing/invalid API key**: prompt to set key in Settings.
- **Provider error**: show error with retry, keep export file for inspection.
- **Payload too large**: prompt to reduce date range or row count.

## Reconciliation Algorithms (v1)

### Receipt ↔ Transaction Matching
**Score components** (0–1 each):\n- **Amount match**: exact = 1.0, within 1% = 0.7\n- **Date proximity**: same day = 1.0, ±1 day = 0.8, ±2–3 days = 0.5\n- **Merchant similarity**: normalized string similarity\n- **Account hint**: if receipt text includes card last‑4 or account nickname\n\n**Weighted score**\n```\nscore = 0.5*amount + 0.2*date + 0.2*merchant + 0.1*account\n```\n\n**Thresholds**\n- `score >= 0.85`: auto‑suggested match\n- `score >= 0.95`: optionally auto‑link (opt‑in)\n\n### Duplicate Detection\n- Potential duplicates if:\n  - same `amount` and `date` and `merchant` within the same source file, or\n  - `source_hash` already seen\n\n### Split Assistance\n- If receipt line items sum to transaction amount ± tolerance, suggest split.\n- If mismatch, show remaining “unassigned” amount.\n+
## UI Flows (v1)

### Import Flow
1. User opens app → auto scan `Inbox/`.
2. User clicks Refresh (manual re-scan).
3. App parses CSV statements and copies receipts to `Data/receipts/`.
4. Import results shown with errors/warnings.

### Transactions Flow
1. Default view loads last 90 days from `transactions.csv`.
2. User filters or searches.
3. Inline edits write to `changes.csv`.
4. Multi-edit applies changes to selected rows.

### Receipt Linking Flow
1. User selects transaction → “Link receipt”.
2. Choose receipt from index or search.
3. Optional line-item selection.
4. Write `link_receipt` change; materialize updates.

### Split Flow
1. User selects transaction → “Split”.
2. Add child rows (amount/category/notes).
3. Save → `change_type=split` written.
4. Materializer creates child rows in `transactions.csv`.

### LLM Q&A Flow
1. User opens Ask tab and enters question.
2. App builds filtered export (CSV/MD).
3. If API key exists, send to provider.
4. Show response + “view data sent”.

## API Interfaces (internal)

### Importer
```ts
importStatements(paths: string[]): Promise<ImportResult>
```

### Ledger
```ts
appendLedger(rows: LedgerRow[]): Promise<void>
appendChange(change: ChangeRow): Promise<void>
materialize(): Promise<void>
```

### Receipts
```ts
ingestReceipts(paths: string[]): Promise<ReceiptIndexRow[]>
runOcr(receiptId: string): Promise<void>
```

### Matching
```ts
linkReceipt(txId: string, receiptId: string, lineItemId?: string): Promise<void>
unlinkReceipt(txId: string, receiptId: string): Promise<void>
```

### LLM
```ts
exportForLlm(filters: ExportFilters, format: "csv" | "md"): Promise<string>
askLlm(prompt: string, dataPath: string, provider: "openai" | "anthropic"): Promise<string>
```
