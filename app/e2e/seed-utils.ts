/**
 * Shared seeding utilities used by all E2E seed scripts.
 */
import { importStatementFiles } from '../../core/importer/statement-importer'
import { materializeTransactions } from '../../core/materializer/index'
import { mkdirSync, copyFileSync } from 'fs'
import { join } from 'path'

export const DEMO_CSV_SRC = join(
  __dirname,
  '../../test-data/statements/1234_checking_demo-bank_2026-05.csv'
)

/** Import the demo CSV into dataFolder and materialize. Returns the number of rows imported. */
export async function seedDemoCsv(dataFolder: string): Promise<number> {
  const csvDest = join(dataFolder, 'demo.csv')
  mkdirSync(dataFolder, { recursive: true })
  copyFileSync(DEMO_CSV_SRC, csvDest)
  const results = await importStatementFiles(dataFolder, { paths: [csvDest] })
  const count = results.reduce((sum, r) => sum + r.rows_imported, 0)
  materializeTransactions(dataFolder)
  return count
}
