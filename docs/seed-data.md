# Seed Data

The seed scripts generate realistic test data so you can develop and test the app without manually importing statements.

## What gets generated

- **163 transactions** across 4 accounts covering 3 months (Mar–May 2026):
  - `1234` — Chase checking (paychecks, health, savings transfers)
  - `5678` — BofA checking (utilities, gas, insurance)
  - `9012` — Ally savings (savings transfers, interest)
  - `3456` — Capital One credit card (groceries, dining, shopping, subscriptions, travel)
- **~16 SVG receipt images** with line items attached to transactions (simulates LLM OCR output)
- **Category assignments** for every transaction (Groceries, Dining, Utilities, Income, etc.)

## Prerequisites

Install dependencies from `app/` first:

```sh
cd app
npm install
```

## Seed

Populate the app's default data folder (`~/Documents/LedgerBox`):

```sh
cd app
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/seed.ts
```

Then reload the running app with **Cmd+R** to see the data.

## Clean and reseed

Wipe all generated data and start fresh:

```sh
cd app
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/clean.ts
```

This deletes the contents of `Data/`, `Inbox/`, and `Data/accounts.json`, then immediately re-runs the seed. The folder structure is preserved.

## Custom data folder

Pass a path as the first argument to target any folder instead of the default:

```sh
# Seed into a disposable temp folder
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/seed.ts /tmp/ledgerbox-dev

# Clean and reseed that same folder
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/clean.ts /tmp/ledgerbox-dev
```

If you use a custom folder, open Settings in the app and point the data folder there before reloading.

## Why NODE_PATH is required

`core/` has no `node_modules` of its own. `NODE_PATH` tells Node to look in `app/node_modules` for shared dependencies (`uuid`, `papaparse`, `date-fns`) when running scripts that import from `core/`.

## What the scripts do internally

`seed.ts` runs in 7 phases:

1. Build transaction rows in memory (merchants, amounts, line items)
2. Write one CSV per account to a temp staging directory
3. Import CSVs via `importStatementFiles()` — identical to the Import page flow
4. Run `materializeTransactions()` to produce `transactions.csv` and get transaction IDs
5. Generate SVG receipt images and detail JSON files directly into `Data/receipts/`
6. Write `link_receipt` and `set_category` change rows via `appendChangeRow()`
7. Run `materializeTransactions()` again to apply the changes

`clean.ts` deletes the data directories listed above, then invokes `seed.ts`.
