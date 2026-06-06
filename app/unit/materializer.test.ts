import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { materializeTransactions, queryTransactions } from '@core/materializer'
import { appendChangeRow } from '@core/ledger/changes'
import { ensureDataStructure, getDataFilePath } from '@core/storage/paths'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'genzeb-unit-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

/** Write a minimal ledger.csv with N rows directly so tests don't need the full importer. */
function writeLedger(
  rows: Array<{
    id: string
    date: string
    merchant: string
    amount: number
    account?: string
  }>
) {
  ensureDataStructure(dir)
  const ledgerPath = getDataFilePath(dir, 'LEDGER')
  const header = 'id,account,date,post_date,description_raw,merchant_raw,amount,currency,source_file,source_hash,import_time'
  const lines = rows.map((r) => `${r.id},${r.account ?? 'Checking'},${r.date},,desc,${r.merchant},${r.amount},USD,file.csv,hash,2026-01-01T00:00:00Z`)
  writeFileSync(ledgerPath, [header, ...lines].join('\n') + '\n', 'utf-8')
}

describe('materializeTransactions + queryTransactions', () => {
  it('materializes ledger rows into queryable transactions', () => {
    writeLedger([
      { id: 'tx1', date: '2026-05-01', merchant: 'Acme', amount: -50 },
      { id: 'tx2', date: '2026-05-02', merchant: 'Baker', amount: -30 }
    ])
    materializeTransactions(dir)
    const { transactions, total } = queryTransactions(dir, {
      filters: {},
      limit: 10,
      offset: 0,
      sortBy: 'date',
      sortOrder: 'desc'
    })
    expect(total).toBe(2)
    expect(transactions[0].merchant).toBe('Baker')
  })

  it('search filter matches merchant', () => {
    writeLedger([
      { id: 'tx1', date: '2026-05-01', merchant: 'Starbucks', amount: -5 },
      { id: 'tx2', date: '2026-05-02', merchant: 'Whole Foods', amount: -80 }
    ])
    materializeTransactions(dir)
    const { transactions } = queryTransactions(dir, {
      filters: { search: 'starbucks' },
      limit: 10,
      offset: 0,
      sortBy: 'date',
      sortOrder: 'asc'
    })
    expect(transactions).toHaveLength(1)
    expect(transactions[0].id).toBe('tx1')
  })

  it('date range filter excludes out-of-range rows', () => {
    writeLedger([
      { id: 'tx1', date: '2026-05-01', merchant: 'A', amount: -10 },
      { id: 'tx2', date: '2026-06-01', merchant: 'B', amount: -20 },
      { id: 'tx3', date: '2026-07-01', merchant: 'C', amount: -30 }
    ])
    materializeTransactions(dir)
    const { transactions } = queryTransactions(dir, {
      filters: { dateRange: { start: '2026-05-15', end: '2026-06-30' } },
      limit: 10,
      offset: 0,
      sortBy: 'date',
      sortOrder: 'asc'
    })
    expect(transactions).toHaveLength(1)
    expect(transactions[0].id).toBe('tx2')
  })

  it('uncategorized filter returns only transactions without a category', () => {
    writeLedger([
      { id: 'tx1', date: '2026-05-01', merchant: 'A', amount: -10 },
      { id: 'tx2', date: '2026-05-02', merchant: 'B', amount: -20 }
    ])
    appendChangeRow(dir, {
      transaction_id: 'tx1',
      change_type: 'set_category',
      value: 'Food'
    })
    materializeTransactions(dir)
    const { transactions } = queryTransactions(dir, {
      filters: { uncategorized: true },
      limit: 10,
      offset: 0,
      sortBy: 'date',
      sortOrder: 'asc'
    })
    expect(transactions).toHaveLength(1)
    expect(transactions[0].id).toBe('tx2')
  })

  it('pagination returns the correct slice', () => {
    writeLedger([
      { id: 'tx1', date: '2026-05-01', merchant: 'A', amount: -1 },
      { id: 'tx2', date: '2026-05-02', merchant: 'B', amount: -2 },
      { id: 'tx3', date: '2026-05-03', merchant: 'C', amount: -3 }
    ])
    materializeTransactions(dir)
    const page1 = queryTransactions(dir, {
      filters: {},
      limit: 2,
      offset: 0,
      sortBy: 'date',
      sortOrder: 'asc'
    })
    const page2 = queryTransactions(dir, {
      filters: {},
      limit: 2,
      offset: 2,
      sortBy: 'date',
      sortOrder: 'asc'
    })
    expect(page1.transactions).toHaveLength(2)
    expect(page1.total).toBe(3)
    expect(page2.transactions).toHaveLength(1)
  })
})

describe('agent changes → ai_edited flag', () => {
  it('marks a transaction ai_edited when an agent change is applied', () => {
    writeLedger([{ id: 'tx1', date: '2026-05-01', merchant: 'Acme', amount: -10 }])
    appendChangeRow(dir, {
      transaction_id: 'tx1',
      change_type: 'set_category',
      value: 'Food',
      agent: 'claude'
    })
    materializeTransactions(dir)
    const { transactions } = queryTransactions(dir, {
      filters: {},
      limit: 10,
      offset: 0,
      sortBy: 'date',
      sortOrder: 'asc'
    })
    expect(transactions[0].ai_edited).toBe(true)
  })

  it('does not mark ai_edited for human changes (no agent field)', () => {
    writeLedger([{ id: 'tx1', date: '2026-05-01', merchant: 'Acme', amount: -10 }])
    appendChangeRow(dir, {
      transaction_id: 'tx1',
      change_type: 'set_category',
      value: 'Food'
    })
    materializeTransactions(dir)
    const { transactions } = queryTransactions(dir, {
      filters: {},
      limit: 10,
      offset: 0,
      sortBy: 'date',
      sortOrder: 'asc'
    })
    expect(transactions[0].ai_edited).toBeFalsy()
  })

  it('applies set_category, set_merchant, set_notes changes', () => {
    writeLedger([{ id: 'tx1', date: '2026-05-01', merchant: 'Old Name', amount: -10 }])
    appendChangeRow(dir, {
      transaction_id: 'tx1',
      change_type: 'set_category',
      value: 'Dining'
    })
    appendChangeRow(dir, {
      transaction_id: 'tx1',
      change_type: 'set_merchant',
      value: 'New Name'
    })
    appendChangeRow(dir, {
      transaction_id: 'tx1',
      change_type: 'set_notes',
      value: 'check this'
    })
    materializeTransactions(dir)
    const { transactions } = queryTransactions(dir, {
      filters: {},
      limit: 10,
      offset: 0,
      sortBy: 'date',
      sortOrder: 'asc'
    })
    expect(transactions[0].category).toBe('Dining')
    expect(transactions[0].merchant).toBe('New Name')
    expect(transactions[0].notes).toBe('check this')
  })

  it('materializes a split change into child transactions', () => {
    writeLedger([{ id: 'tx1', date: '2026-05-01', merchant: 'Market', amount: -30 }])
    appendChangeRow(dir, {
      transaction_id: 'tx1',
      change_type: 'split',
      value: JSON.stringify({
        splits: [
          {
            id: 'food',
            amount: -20,
            category: 'Groceries',
            notes: 'weekly shop'
          },
          { id: 'home', amount: -10, category: 'Household' }
        ]
      })
    })
    materializeTransactions(dir)

    const { transactions, total } = queryTransactions(dir, {
      filters: {},
      limit: 10,
      offset: 0,
      sortBy: 'id',
      sortOrder: 'asc'
    })

    expect(total).toBe(2)
    expect(transactions.map((tx) => tx.id)).toEqual(['tx1:split:food', 'tx1:split:home'])
    expect(transactions.every((tx) => tx.parent_id === 'tx1')).toBe(true)
    expect(transactions[0].amount).toBe(-20)
    expect(transactions[0].category).toBe('Groceries')
    expect(transactions[0].notes).toBe('weekly shop')
    expect(transactions[1].amount).toBe(-10)
    expect(transactions[1].category).toBe('Household')
  })

  it('ignores split changes whose child totals do not match the parent amount', () => {
    writeLedger([{ id: 'tx1', date: '2026-05-01', merchant: 'Market', amount: -30 }])
    appendChangeRow(dir, {
      transaction_id: 'tx1',
      change_type: 'split',
      value: JSON.stringify({
        splits: [
          { id: 'food', amount: -20, category: 'Groceries' },
          { id: 'home', amount: -5, category: 'Household' }
        ]
      })
    })
    materializeTransactions(dir)

    const { transactions, total } = queryTransactions(dir, {
      filters: {},
      limit: 10,
      offset: 0,
      sortBy: 'id',
      sortOrder: 'asc'
    })

    expect(total).toBe(1)
    expect(transactions[0].id).toBe('tx1')
    expect(transactions[0].parent_id).toBeUndefined()
    expect(transactions[0].amount).toBe(-30)
  })
})
