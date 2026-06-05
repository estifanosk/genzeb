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

## UI surfaces

| Page | File | Status |
|---|---|---|
| Transactions | `TransactionsPage.tsx` | Done — table, filters, inline edit, bulk edit, column picker, LLM categorization, receipt expand |
| Item Explorer | `ItemExplorerPage.tsx` | Done — line-item browser from receipt detail JSON |
| Receipts | `ReceiptsPage.tsx` | Done — thumbnail list, OCR/linked badges, expandable full image + line items |
| Import | `ImportPage.tsx` | Done — CSV statement flow + receipt ingestion flow (two tabs) |
| Reconcile | `ReconcilePage.tsx` | Stub |
| Ask AI | `AskPage.tsx` | Stub |
| Settings | `SettingsPage.tsx` | Done — data folder, API keys, categories, rules |

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
