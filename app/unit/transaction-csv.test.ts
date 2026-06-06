import { describe, it, expect } from 'vitest'
import { buildTransactionCsv } from '../src/main/ipc/transaction-csv'
import type { TransactionRow } from '@core/types'

function tx(overrides: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 'abc', account: 'Checking', date: '2026-01-01', amount: -10,
    currency: 'USD', source_file: '', source_hash: '',
    import_time: '', description: '', merchant: '',
    ...overrides,
  } as TransactionRow
}

describe('buildTransactionCsv', () => {
  it('produces a header row + one data row', () => {
    const csv = buildTransactionCsv([tx({ merchant: 'Starbucks', amount: -5.5 })])
    const lines = csv.split('\n')
    expect(lines[0]).toBe('date,merchant,description,amount,category,subcategory,account,notes')
    expect(lines[1]).toContain('Starbucks')
    expect(lines[1]).toContain('-5.5')
  })

  it('escapes commas inside field values', () => {
    const csv = buildTransactionCsv([tx({ merchant: 'Acme, Inc.' })])
    expect(csv).toContain('"Acme, Inc."')
  })

  it('escapes double-quotes inside field values', () => {
    const csv = buildTransactionCsv([tx({ description: 'Say "hello"' })])
    expect(csv).toContain('"Say ""hello"""')
  })

  it('returns just the header for an empty array', () => {
    const csv = buildTransactionCsv([])
    expect(csv).toBe('date,merchant,description,amount,category,subcategory,account,notes')
  })

  it('renders one line per transaction plus the header', () => {
    const rows = [tx(), tx(), tx()]
    const lines = buildTransactionCsv(rows).split('\n')
    expect(lines).toHaveLength(4)
  })
})
