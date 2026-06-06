/**
 * Seeds 6 demo transactions and writes one agent change on the first transaction,
 * then rematerializes. Used for AI-badge E2E tests.
 *
 * Usage: NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json e2e/seed-agent.ts <dataFolder>
 */
import { importStatementFiles } from '../../core/importer/statement-importer'
import { materializeTransactions, queryTransactions } from '../../core/materializer/index'
import { appendChangeRow } from '../../core/ledger/changes'
import { mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'

const dataFolder = process.argv[2]
if (!dataFolder) throw new Error('Usage: seed-agent.ts <dataFolder>')

async function main() {
  const csvSrc = join(__dirname, '../../test-data/statements/1234_checking_demo-bank_2026-05.csv')
  const csvDest = join(dataFolder, 'demo.csv')
  mkdirSync(dataFolder, { recursive: true })
  copyFileSync(csvSrc, csvDest)
  await importStatementFiles(dataFolder, { paths: [csvDest] })
  materializeTransactions(dataFolder)

  // Pick the first transaction and write an agent change on it
  const { transactions } = queryTransactions(dataFolder, {
    filters: {},
    limit: 1,
    offset: 0,
    sortBy: 'date',
    sortOrder: 'asc',
  })
  if (!transactions.length) throw new Error('No transactions after seeding')
  appendChangeRow(dataFolder, {
    transaction_id: transactions[0].id,
    change_type: 'set_category',
    value: 'Income',
    agent: 'claude',
  })

  materializeTransactions(dataFolder)
  console.log(`Seeded agent change on transaction ${transactions[0].id} → ${dataFolder}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
