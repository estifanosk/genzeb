/**
 * E2E seed script — imports the 6-row demo CSV and materializes transactions.
 * Run via tsx from e2e/fixtures.ts helpers.
 *
 * Usage:
 *   NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json e2e/seed.ts <dataFolder>
 */
import { importStatementFiles } from '../../core/importer/statement-importer'
import { materializeTransactions } from '../../core/materializer/index'
import { mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'

const dataFolder = process.argv[2]
if (!dataFolder) throw new Error('Usage: seed.ts <dataFolder>')

async function main() {
  const csvSrc = join(__dirname, '../../test-data/statements/1234_checking_demo-bank_2026-05.csv')
  const csvDest = join(dataFolder, 'demo.csv')
  mkdirSync(dataFolder, { recursive: true })
  copyFileSync(csvSrc, csvDest)
  const results = await importStatementFiles(dataFolder, { paths: [csvDest] })
  const count = results.reduce((sum, r) => sum + r.rows_imported, 0)
  materializeTransactions(dataFolder)
  console.log(`Seeded ${count} transactions → ${dataFolder}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
