# Seed Data

The seed script generates realistic test data so you can develop and test the app without manually importing statements.

## What gets generated

**~577 transactions** across 5 accounts covering 6 months (Jan–Jun 2026), ~58 SVG receipts with line items, category assignments for every transaction, and 3 OCR failure fixtures.

### Accounts

| Account | Type | Bank | Primary use |
|---------|------|------|-------------|
| `1234` | Checking | Chase | Paychecks, CC payments (Capital One + Amex), savings transfers, health |
| `5678` | Checking | Bank of America | Utilities, gas, insurance |
| `9012` | Savings | Ally | Savings transfers in, monthly interest |
| `3456` | Credit card | Capital One | Day-to-day spending — groceries, coffee, dining, rideshare, subscriptions, shopping |
| `7890` | Credit card | Amex | Fine dining, travel (vacation spikes in Feb & May), premium shopping |

### Transaction types

| Type | Account | Frequency | Amount range |
|------|---------|-----------|--------------|
| Paycheck (Acme Corp) | `1234` | Twice/month (1st & 15th) | $3,200–$5,500 |
| Savings transfer | `1234` → `9012` | Monthly (5th) | $300–$800 |
| Capital One CC payment | `1234` | Monthly (20th) | $800–$2,200 |
| Amex CC payment | `1234` | Monthly (22nd) | $600–$1,800 |
| Amex annual fee | `7890` | Once (Jan) | $695 |
| Utilities & insurance | `5678` | Monthly per provider | varies |
| Gas | `5678` | Every 10–14 days | $28–$85 |
| Subscriptions | `3456` | Monthly per service | $0.99–$25 |
| Groceries | `3456` | 2–3× per week | $30–$180 |
| Dining | `3456` | 2–4× per week | $5–$95 |
| Coffee (Starbucks) | `3456` | ~4× per week | $5–$18 |
| Rideshare (Uber/Lyft) | `3456` | ~3× per week | $7–$45 |
| Shopping | `3456` | ~40 sporadic | $15–$400 |
| Fine dining | `7890` | ~2–3×/month | $65–$400 |
| Travel (flights + hotels) | `7890` | Feb & May vacations + occasional | $120–$850 |
| Premium online shopping | `7890` | ~6×/month | $15–$400 |
| Health / pharmacy | `1234` | ~15 sporadic | $8–$85 |
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
<summary>Fine dining (Amex)</summary>

Le Bernardin, Nobu, The French Laundry, Chez Panisse, Atelier Crenn

</details>

<details>
<summary>Travel (Amex)</summary>

Delta Airlines, United Airlines, Alaska Airlines, American Airlines, Marriott Hotels, Hilton Hotels, Hyatt, Airbnb

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
<summary>Transportation</summary>

Uber, Lyft

</details>

<details>
<summary>Health</summary>

CVS Pharmacy, Walgreens

</details>

### Receipts and line items

~10% of transactions (those from grocery, dining, shopping, and health merchants) get an SVG receipt image and a receipt detail JSON file. Each receipt has 2–6 line items with description, quantity, unit price, and total. The JSON simulates what the LLM OCR step would produce, so the Item Explorer and transaction receipt expand work without needing an API key.

Of those receipts, **~70% are linked** to their transaction (via a `link_receipt` change) and **~30% are left unlinked** — they exist in the receipts index and have full detail JSON but no transaction association. The unlinked receipts are intentional: they let the Reconcile page demo work with receipts that are waiting to be matched.

In addition, **3 OCR failure fixtures** are created: 2 with `ocr_status: failed` and 1 with `ocr_status: pending`. These have a real SVG image but no detail JSON, simulating receipts where OCR never completed. They appear on the Receipts page with a retry button so the re-run OCR flow can be tested without importing real photos.

### Categories

Every transaction is assigned one of: Coffee, Dining, Electronics, Entertainment, Gas, Groceries, Health, Home, Income, Insurance, Payment, Shopping, Subscriptions, Transfer, Transportation, Travel, Utilities.

## Prerequisites

Install dependencies from `app/` first:

```sh
cd app
npm install
```

## Seed

Populate the app's default data folder (`~/Documents/Genzeb`):

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

Then reload the running app with **Cmd+R** (macOS) or **Ctrl+R** (Windows/Linux) to see the data.

## Clean and reseed

Wipe all generated data and start fresh:

**macOS / Linux:**
```sh
cd app
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/clean.ts
```

**Windows (PowerShell):**
```powershell
cd app
$env:NODE_PATH=".\node_modules"; npx tsx --tsconfig tsconfig.node.json ..\scripts\clean.ts
```

This deletes the contents of `Data/`, `Inbox/`, and `Data/accounts.json`, then immediately re-runs the seed. The folder structure is preserved.

## Custom data folder

Pass a path as the first argument to target any folder instead of the default:

**macOS / Linux:**
```sh
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/seed.ts /tmp/genzeb-dev
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/clean.ts /tmp/genzeb-dev
```

**Windows (PowerShell):**
```powershell
$env:NODE_PATH=".\node_modules"; npx tsx --tsconfig tsconfig.node.json ..\scripts\seed.ts C:\genzeb-dev
$env:NODE_PATH=".\node_modules"; npx tsx --tsconfig tsconfig.node.json ..\scripts\clean.ts C:\genzeb-dev
```

If you use a custom folder, open Settings in the app and point the data folder there before reloading.

## Why NODE_PATH is required

`core/` has no `node_modules` of its own. `NODE_PATH` tells Node to look in `app/node_modules` for shared dependencies (`uuid`, `papaparse`, `date-fns`) when running scripts that import from `core/`.

## What the scripts do internally

`seed.ts` runs in 8 phases:

1. Build transaction rows in memory (merchants, amounts, line items)
2. Write one CSV per account to a temp staging directory
3. Import CSVs via `importStatementFiles()` — identical to the Import page flow
4. Run `materializeTransactions()` to produce `transactions.csv` and get transaction IDs
5. Generate SVG receipt images and detail JSON files directly into `Data/receipts/`
5b. Create 3 OCR failure fixtures (2 × failed, 1 × pending) — SVG only, no JSON
6. Write `link_receipt` and `set_category` change rows via `appendChangeRow()`
7. Run `materializeTransactions()` again to apply the changes

`clean.ts` deletes the data directories listed above, then invokes `seed.ts`.
