# Architecture

## Overview

LedgerBox is a local-first Electron desktop app. All data lives in a user-chosen folder on disk — no server, no cloud sync dependency. The codebase is split into two packages that live in the same repository:

```
ledgerbox/
  app/      Electron shell, IPC handlers, React UI
  core/     Pure TypeScript domain logic (no Electron dependency)
  scripts/  Dev utilities (seed, clean)
  docs/     Design notes and how-tos
```

`core/` can be imported and tested outside of Electron. `app/` wires `core/` to the OS via Electron IPC.

---

## Process model

Electron runs two processes. Communication between them goes through a typed IPC bridge defined in `core/types/ipc.ts`.

```
┌─────────────────────────────────┐      IPC (typed channels)
│  Main process  (Node.js)        │ ◄──────────────────────────►
│  app/src/main/                  │
│  • IPC handlers                 │      ┌──────────────────────┐
│  • File I/O via core/           │      │  Renderer process    │
│  • Settings persistence         │      │  (Chromium + React)  │
│  • Electron window lifecycle    │      │  app/src/renderer/   │
└─────────────────────────────────┘      └──────────────────────┘
                                                    ▲
                                         preload script exposes
                                         window.api (contextBridge)
                                         app/src/preload/index.ts
```

The preload script (`app/src/preload/index.ts`) is the only bridge between the two processes. It exposes a typed `window.api` object to the renderer — no `require` or Node APIs are available in the renderer directly.

---

## Core package (`core/`)

Pure domain logic. Each subdirectory is a self-contained module.

```
core/
  importer/         CSV statement parsing, column auto-mapping, dedup
  materializer/     Builds transactions.csv from ledger + changes; query functions
  ledger/           changes.csv append and read (the edit log)
  receipts/
    importer.ts     Receipt ingestion, index management, match scoring
    llm.ts          LLM OCR extraction, receipt detail JSON read/write
  rules/            Category rules and category list persistence
  accounts/         Account metadata read/write (accounts.json)
  llm/              LLM categorization of transactions
  data-admin/       Bulk delete and clear-all utilities
  storage/
    paths.ts        Central definition of all folder/file paths within a data folder
    file-hash.ts    SHA1 hashing for dedup
    imported-files.ts  Move-to-imported logic
  types/
    index.ts        All domain types (LedgerRow, TransactionRow, ReceiptDetail, …)
    ipc.ts          IPC channel names, request/response types, LedgerBoxAPI interface
```

### Data pipeline

The core pipeline runs in three stages, each driven by an explicit IPC call or script invocation:

```
CSV statement file
      │
      ▼
importStatementFiles()          core/importer/statement-importer.ts
  • parse CSV, map columns
  • dedup by source_hash
  • append to ledger.csv
  • write import-log.csv
  • move source file to Inbox/statements/imported/
      │
      ▼
materializeTransactions()       core/materializer/index.ts
  • read ledger.csv (raw rows)
  • read changes.csv (edit log)
  • apply changes in timestamp order
  • apply category rules
  • write transactions.csv
  • rebuild SQLite index
      │
      ▼
queryTransactions() / queryLineItems()
  • read transactions.csv
  • filter, sort, paginate
  • return to renderer via IPC
```

### Edit model (append-only)

Transactions are never mutated. Instead, every user edit appends a row to `changes.csv`:

```
change_id | transaction_id | change_type   | value
──────────┼────────────────┼───────────────┼──────────────
uuid      | tx-uuid        | set_category  | Groceries
uuid      | tx-uuid        | set_merchant  | Whole Foods
uuid      | tx-uuid        | link_receipt  | receipt-uuid
uuid      | tx-uuid        | split         | {"splits":[…]}
```

`materializeTransactions()` replays all changes on top of the raw ledger rows to produce the current view. This means the ledger is always recoverable and edit history is preserved.

### Receipt pipeline

```
Receipt image (PNG/JPG/SVG/…)
      │
      ▼
ingestReceipts()                core/receipts/importer.ts
  • copy to Data/receipts/<id>.ext
  • write row to Data/receipts/index.csv  (ocr_status: 'pending')
  • score candidate transactions by date + amount proximity
  • if match found: write links.csv row + append link_receipt change
      │
      ▼
runReceiptLlmExtract()          core/receipts/llm.ts
  • encode image as base64 data URI
  • call OpenAI with structured JSON schema
  • return ReceiptDetail (merchant, date, total, line_items[])
      │
      ▼
saveReceiptDetail()
  • write Data/receipts/<id>.json
  • update index.csv row (ocr_status: 'ok', merchant, date, total)
```

---

## App package (`app/`)

```
app/src/
  main/
    index.ts          Electron entry: creates BrowserWindow, registers IPC handlers
    ipc/
      index.ts        All ipcMain.handle() registrations (~40 channels)
      settings.ts     Read/write ~/Library/Application Support/ledgerbox/settings.json
      file-system.ts  Inbox scanning, folder picker, data structure init
  preload/
    index.ts          contextBridge: exposes window.api to renderer
  renderer/src/
    App.tsx           Root component: page state, sidebar routing
    pages/            One file per page (see UI surfaces below)
    components/
      layout/         Sidebar navigation
      ui/             Button, Card, Input, Tabs (Radix + Tailwind)
    stores/
      settings.ts     Zustand store: app settings, loaded once on mount
    hooks/            Shared React hooks
    lib/utils.ts      cn() helper (clsx + tailwind-merge)
```

### IPC layer

All renderer ↔ main communication goes through channels defined in `core/types/ipc.ts`. The pattern is:

```
Renderer                  Preload                     Main
window.api.getReceipts()  ipcRenderer.invoke(...)  →  ipcMain.handle(GET_RECEIPTS)
                                                        calls core/receipts/importer.readReceiptIndex()
                                                        returns ReceiptIndexRow[] + linked status
```

There are ~40 registered channels covering: file system, import, ledger changes, materialization, receipts, matching, rules, settings, accounts, and LLM.

---

## Feature status

### Import

| Feature | Status | Where | What's missing |
|---|---|---|---|
| CSV statement import — column auto-map, dedup, ledger.csv | ✅ Done | Import → Statements tab | — |
| Receipt ingestion — select, preview, LLM OCR, auto-link to transaction | ✅ Done | Import → Receipts tab | — |
| Import history log — per-file record of every import run | ✅ Done | Import → History tab | — |

### Transactions

| Feature | Status | Where | What's missing |
|---|---|---|---|
| Transaction table with filters, sort, pagination | ✅ Done | Transactions page | — |
| Inline edit — merchant, category, subcategory, notes | ✅ Done | Transactions page | — |
| Bulk edit across selected rows | ✅ Done | Transactions page | — |
| Column picker | ✅ Done | Transactions page | — |
| Receipt expand — linked receipt image + line items | ✅ Done | Transactions page | — |
| Change history — per-transaction audit trail | ✅ Done | Transactions page (expand) | — |
| Transaction splits | ⚠️ Partial | — | Core + materializer handle it; no split button in the UI |

### Receipts & line items

| Feature | Status | Where | What's missing |
|---|---|---|---|
| Receipt browser — thumbnails, OCR status, linked/unlinked badges | ✅ Done | Receipts page | — |
| Receipt expand — full image + line items | ✅ Done | Receipts page | — |
| Item Explorer — all line items including unlinked receipts | ✅ Done | Item Explorer page | — |
| Linked/unlinked filter + status badge in Item Explorer | ✅ Done | Item Explorer page | — |
| Re-run OCR on a failed receipt | ❌ Stub | — | `RUN_OCR` IPC handler is a no-op |

### Reconcile

| Feature | Status | Where | What's missing |
|---|---|---|---|
| Match suggestions — score unlinked receipts against transactions | ❌ Stub | Reconcile page | `GET_MATCH_SUGGESTIONS` returns `[]`; scoring logic exists in `core/receipts/importer.ts` (`computeMatches`) but isn't wired to the UI |
| Manual receipt linking | ❌ Stub | Reconcile page | `LINK_RECEIPT` is a no-op |
| Receipt unlinking | ❌ Stub | Reconcile page | `UNLINK_RECEIPT` is a no-op |
| Links audit trail | ❌ Stub | — | `GET_LINKS` returns `[]` |

### Ask AI

| Feature | Status | Where | What's missing |
|---|---|---|---|
| Export transactions for LLM (CSV / Markdown) | ❌ Stub | — | `EXPORT_FOR_LLM` returns `''` |
| In-app LLM Q&A over filtered transactions | ❌ Stub | Ask AI page | `ASK_LLM` returns `''` |

### Settings & categorization

| Feature | Status | Where | What's missing |
|---|---|---|---|
| Data folder selection | ✅ Done | Settings | — |
| Inbox folder paths | ✅ Done | Settings | — |
| API keys (OpenAI, Anthropic) | ✅ Done | Settings | — |
| Category list editor | ✅ Done | Settings → Categories tab | — |
| Auto-categorization rules editor | ✅ Done | Settings → Rules tab | — |
| LLM bulk categorization | ✅ Done | Settings → LLM Categorize tab | — |

### Dev / test

| Feature | Status | Where | What's missing |
|---|---|---|---|
| Seed script — realistic transactions, receipts, categories | ✅ Done | `scripts/seed.ts` | — |
| Clean + reseed script | ✅ Done | `scripts/clean.ts` | — |
| Core pipeline smoke test | ✅ Done | `app/smoke-test.ts` | UI-level (Playwright) test not built |

---

## Data folder layout

The data folder is user-chosen (default `~/Documents/LedgerBox`). All paths are relative to it and defined in `core/storage/paths.ts`.

```
LedgerBox/
  Inbox/
    statements/           Drop CSV statements here for import
      imported/           Moved here after successful import
    receipts/             Drop receipt images here for ingestion
      imported/           Moved here after ingestion
  Data/
    transactions/
      ledger.csv          Append-only raw import log (one row per transaction)
      changes.csv         Append-only edit log (one row per user action)
      transactions.csv    Materialised view (rebuilt from ledger + changes)
      import-log.csv      One row per imported file (with source hash)
    receipts/
      index.csv           Receipt metadata and OCR status
      <uuid>.svg/.jpg/…   Receipt image files
      <uuid>.json         Receipt detail JSON (merchant, line items, …)
    matches/
      links.csv           Transaction ↔ receipt links
    rules/
      categories.csv      User-defined category list
      category-rules.csv  Auto-categorization rules
    accounts.json         Account metadata (name, type, bank, last imported)
    index/
      ledger.sqlite       SQLite index for fast filtering (rebuilt on materialize)
  Exports/
    llm/                  LLM export files (CSV/Markdown snapshots)
```

---

## Settings persistence

App settings (data folder path, API keys, preferences) are stored separately from the data folder in the OS app-data directory:

```
~/Library/Application Support/ledgerbox/settings.json
```

Managed by `app/src/main/ipc/settings.ts`. The renderer reads settings via the `GET_SETTINGS` IPC channel on mount and caches them in the Zustand settings store.
