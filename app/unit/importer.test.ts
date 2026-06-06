import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, copyFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { importStatementFiles } from '@core/importer/statement-importer'
import { materializeTransactions, queryTransactions } from '@core/materializer'

const DEMO_CSV_SRC = join(__dirname, '../e2e/fixtures/1234_checking_demo-bank_2026-05.csv')

let dir: string
// The importer moves source files after import, so each test needs its own copy.
let demoCsv: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'genzeb-unit-'))
  demoCsv = join(dir, 'demo.csv')
  copyFileSync(DEMO_CSV_SRC, demoCsv)
})
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

describe('importStatementFiles', () => {
  it('imports 6 rows from the demo CSV', async () => {
    const [result] = await importStatementFiles(dir, { paths: [demoCsv] })
    expect(result.rows_imported).toBe(6)
    expect(result.errors).toHaveLength(0)
  })

  it('transactions are queryable after materializing', async () => {
    await importStatementFiles(dir, { paths: [demoCsv] })
    materializeTransactions(dir)
    const { total } = queryTransactions(dir, { filters: {}, limit: 10, offset: 0, sortBy: 'date', sortOrder: 'desc' })
    expect(total).toBe(6)
  })

  it('skips duplicate rows on re-import', async () => {
    await importStatementFiles(dir, { paths: [demoCsv] })
    // The importer moves the source file; make a second copy with the same content.
    const demoCsv2 = join(dir, 'demo2.csv')
    copyFileSync(DEMO_CSV_SRC, demoCsv2)
    const [second] = await importStatementFiles(dir, { paths: [demoCsv2] })
    expect(second.duplicates).toHaveLength(1)
    expect(second.rows_imported).toBe(0)
  })

  it('preserves merchant and amount from demo data', async () => {
    await importStatementFiles(dir, { paths: [demoCsv] })
    materializeTransactions(dir)
    const { transactions } = queryTransactions(dir, { filters: { search: 'acme' }, limit: 5, offset: 0, sortBy: 'date', sortOrder: 'asc' })
    expect(transactions).toHaveLength(1)
    expect(transactions[0].amount).toBe(2500)
  })

  it('debit transactions have negative amounts', async () => {
    await importStatementFiles(dir, { paths: [demoCsv] })
    materializeTransactions(dir)
    const { transactions } = queryTransactions(dir, {
      filters: { amountRange: { max: 0 } },
      limit: 10, offset: 0, sortBy: 'date', sortOrder: 'asc',
    })
    expect(transactions.length).toBe(5)
    expect(transactions.every(tx => tx.amount < 0)).toBe(true)
  })
})
