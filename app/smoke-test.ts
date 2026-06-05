/**
 * Genzeb Smoke Test
 *
 * What it does
 * ------------
 * Exercises the three core pipeline stages end-to-end using a fixed 6-row
 * sample CSV statement (test-data/statements/1234_checking_demo-bank_2026-05.csv):
 *
 *   1. Import  — parses the CSV, maps columns, deduplicates, and writes
 *                ledger.csv + import-log.csv into the data folder.
 *   2. Materialize — reads ledger.csv + changes.csv, applies rules, and
 *                    writes transactions.csv (the view the UI reads).
 *   3. Query   — calls the same query function the Transactions page uses
 *                and asserts that exactly 6 rows come back.
 *
 * The source CSV is copied to the data folder before import so the importer's
 * "move-to-imported" step doesn't destroy the original test fixture.
 *
 * How to run
 * ----------
 * From the `app/` directory:
 *
 *   macOS / Linux:
 *     NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json smoke-test.ts
 *
 *   Windows (PowerShell):
 *     $env:NODE_PATH=".\node_modules"; npx tsx --tsconfig tsconfig.node.json smoke-test.ts
 *
 * Optionally pass a data folder as the first argument (defaults to a temp folder):
 *
 *   NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json smoke-test.ts /path/to/folder
 *
 * Why NODE_PATH is required
 * -------------------------
 * The core/ package lives outside app/ and doesn't have its own node_modules.
 * NODE_PATH tells Node where to find shared dependencies (uuid, papaparse, date-fns)
 * that are installed under app/node_modules.
 */

import { importStatementFiles } from '../core/importer/statement-importer'
import { materializeTransactions, queryTransactions } from '../core/materializer/index'
import { existsSync, mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'

const DATA_FOLDER = process.argv[2] || '/tmp/genzeb-smoke'
const TEST_CSV_ORIGINAL = '/Users/estifanoskidane/projects/genzeb/test-data/statements/1234_checking_demo-bank_2026-05.csv'

async function main() {
  if (!existsSync(DATA_FOLDER)) mkdirSync(DATA_FOLDER, { recursive: true })

  // Copy CSV into the data folder so the importer's move-to-imported step
  // doesn't destroy the original test fixture.
  const TEST_CSV = join(DATA_FOLDER, '1234_checking_demo-bank_2026-05.csv')
  copyFileSync(TEST_CSV_ORIGINAL, TEST_CSV)

  console.log('=== Genzeb Smoke Test ===\n')

  // Step 1: Import
  console.log('--- Step 1: Import CSV ---')
  const results = await importStatementFiles(DATA_FOLDER, { paths: [TEST_CSV] })
  for (const r of results) {
    const status = r.duplicates.length ? 'DUPLICATE' : `${r.rows_imported} imported`
    console.log(`  ${r.source_file}: ${status}, ${r.rows_skipped} skipped`)
    if (r.errors.length) r.errors.forEach(e => console.log(`    ERROR row ${e.row}: ${e.message}`))
  }

  // Step 2: Materialize
  console.log('\n--- Step 2: Materialize ---')
  materializeTransactions(DATA_FOLDER)
  console.log('  Done')

  // Step 3: Query
  console.log('\n--- Step 3: Query transactions ---')
  const txns = queryTransactions(DATA_FOLDER, { limit: 20 })
  console.log(`  Total: ${txns.total}`)
  for (const t of txns.transactions) {
    console.log(`  [${t.date}] ${(t.merchant || t.description).padEnd(22)} ${String(t.amount.toFixed(2)).padStart(10)}`)
  }

  if (txns.total !== 6) throw new Error(`Expected 6 transactions, got ${txns.total}`)
  console.log('\n=== PASSED ===')
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1) })
