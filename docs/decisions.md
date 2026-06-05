# LedgerBox — Decision Log

A running journal of design and product decisions. Each entry is dated so context doesn't rot.

---

## 2026-02-14 — Initial direction

**Goals**
- Personal desktop app for one user, not a team tool.
- Local-first: all data on the user's file system, no cloud dependency.
- No bank aggregation (Plaid/Finicity) — rely entirely on file imports.
- Primary workflow: import → categorize → reconcile → review.

**Platform**
- Electron desktop app (macOS first).

**Import formats**
- MVP: CSV statements only. PDF parsing deferred.
- OFX/QFX considered and dropped — CSV covers all major banks via export.

**Receipts**
- Desktop file import/scanning preferred over a mobile companion to avoid storing personal data on a third-party server.

**AI**
- Cloud LLM APIs (OpenAI/Anthropic) preferred over local models — avoids large on-device installs.
- All LLM features are opt-in via user-supplied API key. No data sent without explicit action.

**Data model decided**
- Append-only `ledger.csv` as the raw import log — never mutated.
- `changes.csv` as the edit log — all user edits (category, merchant, notes, splits, receipt links) append here.
- `transactions.csv` as the materialised view — rebuilt from ledger + changes on demand.
- Receipt detail stored as `{receipt_id}.json` alongside the receipt index CSV.
- SQLite index derived from CSV files for fast filtering — never the source of truth.

Full schema recorded below for reference.

<details>
<summary>Schema v1 (2026-02-14)</summary>

**ledger.csv** — append-only raw import log
- id (UUID), account, date (YYYY-MM-DD), post_date, description_raw, merchant_raw, amount (signed decimal), currency, source_file, source_hash, import_time

**changes.csv** — edit log
- change_id, transaction_id, change_type (`set_category | set_merchant | set_notes | set_subcategory | split | link_receipt | unlink_receipt`), field, value (text or JSON), time

**transactions.csv** — materialised export view
- id, parent_id, account, date, post_date, description, merchant, amount, currency, category, subcategory, notes, receipt_files (semicolon-separated), line_items (JSON), source_file, source_hash, import_time, confidence

**import-log.csv** — one row per imported file
- import_id, source_file, source_hash, file_type, imported_at, rows_imported, rows_skipped, notes

**receipts/index.csv** — receipt metadata
- receipt_id, file_path, receipt_type, merchant, date, total, currency, source_hash, ocr_status (pending | ok | failed), created_at

**receipts/{receipt_id}.json** — OCR detail
- receipt_id, file_path, merchant, date, total, currency, tax, tip, confidence, line_items[], raw_text

**matches/links.csv** — transaction ↔ receipt links
- link_id, transaction_id, receipt_id, line_item_id, amount, confidence, notes

**rules/categories.csv**
- rule_id, match_type, match_value, category, subcategory, priority, enabled
</details>

**LLM Q&A**
- Requested: in-app LLM query panel. User asks a question, app builds a filtered export (CSV/Markdown), sends to selected provider with the user's API key. Data minimisation + opt-in mandatory.

---

## 2026-02-14 — Transactions page scope (v1 non-goals)

Features considered for the Transactions page but deferred out of v1:

- **Saved filter presets** — store named filter combinations locally for quick recall.
- **Duplicate highlighting** — surface rows with the same amount/date/merchant as potential duplicates.
- **"Mark reviewed" action** — let users explicitly sign off on a row without editing it.
- **Default view = last 90 days** — filter to recent transactions on open rather than showing all.
- **Notes-contains filter** — search within the notes column specifically.
- **Column resize** — drag column widths in the table.
- **Export shortcut** — export current filtered view to CSV/Markdown from within the Transactions page (LLM export lives in Ask AI instead).

These can be picked up as small follow-on tasks whenever needed.

---

## 2026-06-05 — UI improvement priorities agreed

Reviewed the full UI. Agreed on 11 improvement tasks in priority order:

1. Amount formatting — $ prefix, red/green colour, thousands separator
2. Window title — fix "Electron" → "LedgerBox"
3. Stub pages — remove "Coming in Phase 8", fix Reconcile copy
4. Toolbar clutter — hide bulk actions unless rows are selected
5. Filtered total — show sum of filtered transactions in footer
6. Sidebar — reorder and add section grouping
7. Filter panel — make collapsible, show active filter count badge
8. Light/dark mode — toggle persisted in localStorage, default to system
9. App logo — SVG icon in sidebar header
10. Relative dates — "Today", "Yesterday" for recent transactions
11. Empty state CTAs — "Import a statement" / "Import a receipt" buttons

No colour palette or full redesign — the dark theme is good, just needs polish and reduced clutter.

## 2026-06-05 — LLM Categorization moved from Transactions to Settings

The LLM Categorization panel was a permanent block above the transaction table. Moved it to Settings → Categories & Rules → LLM Categorize tab.

**Reason:** it's a one-shot bulk operation, not a per-transaction action. The "add API key" prompt already pointed users to Settings, so it belongs there alongside the category list and rules editor. Transactions page should be a pure browsing/editing surface.

---

## 2026-06-05 — Unlinked receipts visible in Item Explorer

Item Explorer previously only traversed transactions → receipt_files → receipt JSON. Unlinked receipts (those not associated with any transaction) were invisible.

**Decision:** add a second pass in `queryLineItems` to surface unlinked receipt line items, clearly marked with an amber "Unlinked" badge. Values come from the receipt detail JSON; transaction context (account, category) is empty until reconciled.

**Reason:** hiding data from the user is worse than showing it with a caveat. The badge directs them to the Receipts page to complete reconciliation.

---

## 2026-06-05 — Receipt import history not duplicated in Import page

The Import → History tab was added to show `import-log.csv`. A parallel "Receipt import history" view was considered but not built.

**Decision:** the Receipts page already surfaces `receipts/index.csv` (ingested-at timestamp, OCR status, linked status) — that is the receipt import log. Building a duplicate in Import would be redundant.
