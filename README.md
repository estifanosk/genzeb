# LedgerBox

A free, local-first desktop app for tracking personal expenses. Import bank and credit card statements, link receipts, categorize transactions, and browse line items — all stored as plain CSV files on your own machine. No cloud, no subscription, no data shared with anyone.

> **Platform:** macOS, Windows, and Linux. Built with Electron so it runs on all three. macOS is the primary development platform — if you hit a platform-specific issue on Windows or Linux, please [open an issue](https://github.com/estifanosk/ledgerbox/issues).

---

## Contents

- [Prerequisites](#prerequisites)
- [Install](#install)
- [First run](#first-run)
- [Load sample data](#load-sample-data)
- [Using your own bank data](#using-your-own-bank-data)
- [Optional: LLM features](#optional-llm-features)
- [For developers](#for-developers)

---

## Prerequisites

- **[Node.js](https://nodejs.org/) 18 or later** — check with `node --version`
- **[Git](https://git-scm.com/)**
- macOS, Windows, or Linux

---

## Install

```sh
git clone https://github.com/estifanosk/ledgerbox.git
cd ledgerbox/app
npm install
```

---

## First run

```sh
cd app          # if not already there
npm run dev
```

This starts the app. On first open you will be prompted to choose a **data folder** — this is where all your expense data will be stored as plain files. A folder like `~/Documents/LedgerBox` works well. It can be inside a cloud-synced folder (Dropbox, iCloud, OneDrive) for automatic backup.

Once set, the app opens on the Transactions page. It will be empty until you import data.

---

## Load sample data

The fastest way to see the app in action is to load the included seed data — 163 realistic transactions across 4 accounts, 16 receipts with line items, and category assignments.

**macOS / Linux:**
```sh
cd app
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/seed.ts
```

**Windows (PowerShell):**
```powershell
cd app
$env:NODE_PATH=".\node_modules"; npx tsx --tsconfig tsconfig.node.json ..\scripts\seed.ts
```

Then press **Cmd+R** (macOS) or **Ctrl+R** (Windows/Linux) in the app to reload. The Transactions page will show all 163 rows.

To wipe everything and start fresh, run `clean.ts` the same way — it wipes the data folder then re-runs the seed automatically.

See [docs/seed-data.md](docs/seed-data.md) for what the sample data contains.

---

## Using your own bank data

### Import a bank statement

1. Export a statement from your bank as a **CSV file**.
2. In LedgerBox, go to **Import → Statements**.
3. Click **Next**, select your CSV, review the column mapping, and import.

LedgerBox auto-detects common column names (Date, Amount, Description, Merchant). If your bank uses different names, you can map them manually in the import preview step.

The statement filename determines the account name. Rename it to match the pattern `{accountNumber}_{type}_{bank}_{period}.csv` for the best results — e.g. `1234_checking_chase_2025-12.csv`. Any filename works if you prefer.

### Import a receipt

1. Go to **Import → Receipts**.
2. Select a receipt image (JPG, PNG, WEBP, PDF).
3. The app previews the image and — if you have an OpenAI API key set in Settings — extracts the merchant, total, and line items automatically.
4. Confirm the match to a transaction and import.

### Categorize transactions

- **Manually** — click any row in Transactions and edit the Category field inline.
- **With rules** — go to Settings → Rules and add merchant-based auto-categorization rules. Click "Apply Rules Now" to re-run them.
- **With LLM** — go to Settings → LLM Categorize, click "Run LLM Categorization" to get AI-suggested categories for all uncategorized transactions. Review and apply the ones you want.

---

## Optional: LLM features

LedgerBox has two opt-in LLM features that use the OpenAI API:

| Feature | Where |
|---|---|
| Receipt OCR — extract merchant, total, line items from a receipt image | Import → Receipts |
| Bulk categorization — suggest categories for uncategorized transactions | Settings → LLM Categorize |

To enable them:

1. Get an [OpenAI API key](https://platform.openai.com/api-keys).
2. In LedgerBox, go to **Settings → API Keys** and paste it in.

Your key is stored locally in `~/Library/Application Support/ledgerbox/settings.json` and is never sent anywhere except directly to OpenAI when you explicitly trigger an LLM action.

---

## For developers

### Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | [Electron 39](https://www.electronjs.org/) |
| Build tooling | [electron-vite 5](https://electron-vite.org/), [Vite 7](https://vite.dev/) |
| UI framework | [React 19](https://react.dev/) |
| Language | [TypeScript 5](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| UI components | [Radix UI](https://www.radix-ui.com/) primitives + [shadcn/ui](https://ui.shadcn.com/) patterns, [Lucide](https://lucide.dev/) icons |
| Table / virtualisation | [@tanstack/react-table](https://tanstack.com/table), [@tanstack/react-virtual](https://tanstack.com/virtual) |
| State management | [Zustand 5](https://zustand.pmnd.rs/) |
| CSV parsing | [PapaParse 5](https://www.papaparse.com/) |
| SQLite index | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Date handling | [date-fns 4](https://date-fns.org/) |
| Validation | [Zod 4](https://zod.dev/) |
| LLM integration | OpenAI API (opt-in, user-supplied key) |

### Repo layout

- `app/` — Electron shell, IPC handlers, React UI, build config
- `core/` — pure TypeScript domain logic (importer, materializer, receipts, rules)
- `scripts/` — seed and clean scripts for development
- `test-data/` — sample CSV for smoke tests
- `docs/` — architecture reference, decision log, how-tos

See [docs/architecture.md](docs/architecture.md) for the process model, data pipeline, IPC layer, and feature status.  
See [docs/decisions.md](docs/decisions.md) for a dated log of design decisions.

### Build a distributable

```sh
cd app
npm run build
```

Output goes to `app/out/`. This produces an unsigned app bundle — for distribution you would need to code-sign it.

### Verify the core pipeline

```sh
# macOS / Linux
cd app
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json smoke-test.ts

# Windows (PowerShell)
cd app
$env:NODE_PATH=".\node_modules"; npx tsx --tsconfig tsconfig.node.json smoke-test.ts
```

See [docs/smoke-test.md](docs/smoke-test.md) for the manual UI smoke test.
