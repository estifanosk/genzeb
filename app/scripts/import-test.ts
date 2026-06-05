import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'fs'
import { tmpdir } from 'os'
import { join, basename } from 'path'
import assert from 'assert'
import { ensureDataStructure, getDataFilePath, getDataDirPath } from '../../core/storage/paths'
import { importStatementFiles } from '../../core/importer/statement-importer'

function lineCount(path: string): number {
  const content = readFileSync(path, 'utf-8').trim()
  if (!content) return 0
  return content.split('\n').length
}

async function run(): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'genzeb-import-test-'))
  ensureDataStructure(tempDir)

  const statementsDir = getDataDirPath(tempDir, 'INBOX_STATEMENTS')
  const csvPath = join(statementsDir, 'statement.csv')
  const csvContent = [
    'Date,Description,Amount',
    '2025-01-02,Coffee Shop,-4.50',
    '2025-01-03,Salary,2000.00'
  ].join('\n')
  writeFileSync(csvPath, csvContent, 'utf-8')

  const results = await importStatementFiles(tempDir, {
    paths: [csvPath],
    account: 'Checking'
  })

  assert.strictEqual(results.length, 1)
  assert.strictEqual(results[0].rows_imported, 2)
  assert.strictEqual(results[0].rows_skipped, 0)

  const ledgerPath = getDataFilePath(tempDir, 'LEDGER')
  const importLogPath = getDataFilePath(tempDir, 'IMPORT_LOG')

  assert.ok(existsSync(ledgerPath), 'ledger.csv was not created')
  assert.ok(existsSync(importLogPath), 'import-log.csv was not created')
  assert.strictEqual(lineCount(ledgerPath), 3)
  assert.strictEqual(lineCount(importLogPath), 2)

  const importedDir = getDataDirPath(tempDir, 'INBOX_STATEMENTS_IMPORTED')
  const importedFiles = readdirSync(importedDir)
  assert.ok(importedFiles.some((file) => file.startsWith(basename(csvPath, '.csv'))))
  assert.ok(!existsSync(csvPath), 'original CSV should be moved to imported folder')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
