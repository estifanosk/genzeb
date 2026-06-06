/**
 * Copies the demo CSV into the inbox/statements folder without importing it.
 * Used by import-via-UI tests so the user can trigger the import through the app.
 *
 * Usage: NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json e2e/seed-inbox.ts <dataFolder>
 */
import { mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'

const dataFolder = process.argv[2]
if (!dataFolder) throw new Error('Usage: seed-inbox.ts <dataFolder>')

async function main() {
  const csvSrc = join(__dirname, './fixtures/1234_checking_demo-bank_2026-05.csv')
  const inboxDir = join(dataFolder, 'Inbox', 'statements')
  mkdirSync(inboxDir, { recursive: true })
  copyFileSync(csvSrc, join(inboxDir, '1234_checking_demo-bank_2026-05.csv'))
  console.log(`Placed demo CSV in inbox → ${inboxDir}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
