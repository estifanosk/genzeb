/**
 * LedgerBox Clean + Reseed Script
 *
 * Wipes all generated data from the data folder, then runs seed.ts.
 * Safe to run repeatedly during development.
 *
 * What gets deleted
 * -----------------
 *   Data/transactions/   — ledger.csv, changes.csv, transactions.csv, import-log.csv
 *   Data/receipts/       — all receipt JSON + SVG files and the index
 *   Data/matches/        — links.csv
 *   Data/index/          — SQLite index
 *   Data/accounts.json   — account metadata
 *   Inbox/statements/    — any staged CSVs and imported originals
 *   Inbox/receipts/      — any staged receipt images
 *
 * The folder structure itself is preserved (ensureDataStructure recreates it).
 *
 * Usage (run from app/)
 * -----
 *   NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/clean.ts [data-folder]
 */

import { rmSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { execSync } from 'child_process'

const DATA_FOLDER = process.argv[2] || join(homedir(), 'Documents', 'LedgerBox')

const DIRS_TO_WIPE = [
  'Data/transactions',
  'Data/receipts',
  'Data/matches',
  'Data/index',
  'Inbox/statements',
  'Inbox/receipts',
]

const FILES_TO_WIPE = [
  'Data/accounts.json',
]

function clean() {
  console.log('=== LedgerBox Clean ===\n')
  console.log('Data folder:', DATA_FOLDER)

  if (!existsSync(DATA_FOLDER)) {
    console.log('  Data folder does not exist — nothing to clean.')
    return
  }

  for (const dir of DIRS_TO_WIPE) {
    const fullPath = join(DATA_FOLDER, dir)
    if (existsSync(fullPath)) {
      rmSync(fullPath, { recursive: true })
      mkdirSync(fullPath, { recursive: true })
      console.log(`  Wiped ${dir}/`)
    }
  }

  for (const file of FILES_TO_WIPE) {
    const fullPath = join(DATA_FOLDER, file)
    if (existsSync(fullPath)) {
      rmSync(fullPath)
      console.log(`  Deleted ${file}`)
    }
  }

  console.log('\nClean done. Running seed...\n')
}

clean()

// Run seed.ts in the same process environment
const seedScript = join(__dirname, 'seed.ts')
const dataArg = process.argv[2] ? ` "${process.argv[2]}"` : ''

execSync(
  `NODE_PATH="${join(__dirname, '../app/node_modules')}" npx tsx --tsconfig "${join(__dirname, '../app/tsconfig.node.json')}" "${seedScript}"${dataArg}`,
  { stdio: 'inherit', cwd: join(__dirname, '../app') }
)
