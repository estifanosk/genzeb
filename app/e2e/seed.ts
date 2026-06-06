/**
 * E2E seed script — imports the 6-row demo CSV and materializes transactions.
 * Run via tsx from e2e/fixtures.ts helpers.
 *
 * Usage:
 *   NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json e2e/seed.ts <dataFolder>
 */
import { seedDemoCsv } from './seed-utils'

const dataFolder = process.argv[2]
if (!dataFolder) throw new Error('Usage: seed.ts <dataFolder>')

async function main() {
  const count = await seedDemoCsv(dataFolder)
  console.log(`Seeded ${count} transactions → ${dataFolder}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
