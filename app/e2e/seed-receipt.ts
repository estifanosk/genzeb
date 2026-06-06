/**
 * Seeds 6 demo transactions and imports one unlinked receipt (matching Harbor Table,
 * 2026-05-08, $46.12) so the reconcile page has a receipt to work with.
 *
 * Usage: NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json e2e/seed-receipt.ts <dataFolder>
 */
import { importStatementFiles } from '../../core/importer/statement-importer'
import { materializeTransactions } from '../../core/materializer/index'
import { ingestReceipts } from '../../core/receipts/importer'
import { mkdirSync, copyFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const dataFolder = process.argv[2]
if (!dataFolder) throw new Error('Usage: seed-receipt.ts <dataFolder>')

async function main() {
  const csvSrc = join(__dirname, './fixtures/1234_checking_demo-bank_2026-05.csv')
  const csvDest = join(dataFolder, 'demo.csv')
  mkdirSync(dataFolder, { recursive: true })
  copyFileSync(csvSrc, csvDest)
  await importStatementFiles(dataFolder, { paths: [csvDest] })
  materializeTransactions(dataFolder)

  // Create a minimal dummy receipt file (content doesn't matter for the importer)
  const receiptPath = join(tmpdir(), 'genzeb-e2e-receipt.jpg')
  writeFileSync(receiptPath, 'FAKE_RECEIPT_FOR_TESTING')

  // Import as unmatched so it shows up unlinked in Reconcile
  ingestReceipts(dataFolder, {
    paths: [receiptPath],
    mode: 'unmatched',
    matchMetadata: { date: '2026-05-08', amount: 46.12, merchant: 'Harbor Table' },
  })

  console.log(`Seeded unlinked receipt → ${dataFolder}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
