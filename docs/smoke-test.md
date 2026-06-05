# Genzeb Smoke Test

Use this after starting the migrated Electron app.

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

Expected files in the disposable data folder:

- `Data/transactions/ledger.csv`
- `Data/transactions/import-log.csv`
- `Data/transactions/transactions.csv`
- `Data/transactions/changes.csv` after an edit
