# Genzeb — Testing

## Manual smoke test

Use this after making changes that touch the import pipeline or the core materializer.

1. Run the app:
   ```bash
   cd app
   npm run dev
   ```
2. In Settings, choose a disposable data folder, for example:
   `/tmp/genzeb-test-data`
3. Open the generated statements inbox:
   `Inbox/statements`
4. Copy this fixture into that folder:
   `test-data/statements/1234_checking_demo-bank_2026-05.csv`
5. In Genzeb, go to Import, refresh, select the CSV, preview it, and import.
6. Go to Transactions and confirm six rows are visible.
7. Edit one category or note, then materialize/refresh and confirm the edit persists.

Expected files in the disposable data folder after the above steps:

- `Data/transactions/ledger.csv`
- `Data/transactions/import-log.csv`
- `Data/transactions/transactions.csv`
- `Data/transactions/changes.csv` (after an edit)

## Core pipeline smoke test (automated)

Exercises import → materialize → query without the UI. Fast, no Electron required.

```bash
cd app
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json smoke-test.ts
```

Pass a custom data folder as the first argument to avoid `/tmp/genzeb-smoke`:

```bash
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json smoke-test.ts /tmp/my-test-folder
```

Expected output: `=== PASSED ===`

## Playwright E2E tests (automated, full UI)

Launches the real Electron app against an isolated temp data folder and drives the UI.

### Run all tests

```bash
cd app
npm run test:e2e
```

This builds the app first (`electron-vite build`) then runs the full suite. Takes ~2 minutes.

### Skip the build (when only test files changed)

```bash
cd app
npx playwright test
```

### Interactive UI mode

```bash
cd app
npm run test:e2e:ui
```

Opens the Playwright UI — lets you run individual tests, see screenshots, and step through actions.

### Debug a single test

```bash
cd app
npm run test:e2e:debug -- e2e/tests/01-launch.spec.ts
```

### Test structure

| File | What it covers |
|---|---|
| `e2e/tests/01-launch.spec.ts` | App launches, sidebar renders, empty state CTA, theme toggle |
| `e2e/tests/02-transactions.spec.ts` | Seeded data loads (6 rows), amount format, date filter, footer total |
| `e2e/tests/03-navigation.spec.ts` | All 6 sidebar pages navigate correctly, empty state CTAs |

### How isolation works

Each test gets a fresh temporary data folder (`/tmp/genzeb-e2e-*`) created before the test and deleted after. Tests that need data call `seedDataFolder()` which imports the demo CSV and materializes 6 transactions before launching the app.

The app reads `E2E_DATA_FOLDER` from the environment (set by the fixture) instead of `settings.json`, so tests never touch your real data.
