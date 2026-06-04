# Seed Data

The seed scripts generate realistic test data so you can develop and test the app without manually importing statements.

## What gets generated

**163 transactions** across 4 accounts covering 3 months (Mar–May 2026), ~16 SVG receipts with line items, and category assignments for every transaction.

### Accounts

| Account | Type | Bank | Primary use |
|---------|------|------|-------------|
| `1234` | Checking | Chase | Paychecks, CC payments, savings transfers, health |
| `5678` | Checking | Bank of America | Utilities, gas, insurance |
| `9012` | Savings | Ally | Savings transfers in, monthly interest |
| `3456` | Credit card | Capital One | Day-to-day spending — groceries, dining, shopping, subscriptions, travel |

### Transaction types

| Type | Account | Frequency | Amount range |
|------|---------|-----------|--------------|
| Paycheck (Acme Corp) | `1234` | Twice/month (1st & 15th) | $3,200–$5,500 |
| Savings transfer | `1234` → `9012` | Monthly (5th) | $300–$800 |
| Credit card payment | `1234` | Monthly (20th) | $800–$2,200 |
| Utilities & insurance | `5678` | Monthly per provider | varies |
| Gas | `5678` | Every 10–14 days | $28–$85 |
| Subscriptions | `3456` | Monthly per service | $0.99–$25 |
| Groceries | `3456` | 2–3× per week | $30–$180 |
| Dining | `3456` | 2–4× per week | $5–$95 |
| Shopping | `3456` | ~15 sporadic | $15–$400 |
| Travel | `3456` | ~4 sporadic | $7–$650 |
| Health / pharmacy | `1234` | ~8 sporadic | $8–$85 |
| Savings interest | `9012` | Monthly (28th) | $1–$25 |

### Merchants

<details>
<summary>Groceries</summary>

Whole Foods Market, Trader Joe's, Kroger, Safeway

</details>

<details>
<summary>Dining & coffee</summary>

Starbucks, Chipotle Mexican Grill, McDonald's, Panera Bread, The Cheesecake Factory, Panda Express, Local Sushi Bar

</details>

<details>
<summary>Shopping</summary>

Amazon, Target, Best Buy, Home Depot

</details>

<details>
<summary>Utilities & insurance</summary>

Pacific Gas & Electric, Comcast Internet, AT&T Wireless, City Water Dept, Progressive Insurance

</details>

<details>
<summary>Subscriptions</summary>

Netflix, Spotify Premium, Amazon Prime, Hulu, Apple iCloud+, YouTube Premium, Microsoft 365, Planet Fitness

</details>

<details>
<summary>Gas</summary>

Shell Gas Station, BP Gas Station, Chevron, ExxonMobil

</details>

<details>
<summary>Travel & transportation</summary>

United Airlines, Marriott Hotels, Airbnb, Uber, Lyft

</details>

<details>
<summary>Health</summary>

CVS Pharmacy, Walgreens

</details>

### Receipts and line items

~10% of transactions (those from grocery, dining, shopping, and health merchants) get an SVG receipt image and a receipt detail JSON file. Each receipt has 2–6 line items with description, quantity, unit price, and total. The JSON simulates what the LLM OCR step would produce, so the Item Explorer and transaction receipt expand work without needing an API key.

### Categories

Every transaction is assigned one of: Coffee, Dining, Electronics, Entertainment, Gas, Groceries, Health, Home, Income, Insurance, Payment, Shopping, Subscriptions, Transfer, Transportation, Travel, Utilities.

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
