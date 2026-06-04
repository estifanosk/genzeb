import { existsSync, readFileSync, writeFileSync } from 'fs'
import Papa from 'papaparse'
import { ensureDataStructure, getDataFilePath } from '../utils/paths'
import type { LedgerRow, TransactionRow } from '../../shared/types'

const LEDGER_HEADERS = [
  'id',
  'account',
  'date',
  'post_date',
  'description_raw',
  'merchant_raw',
  'amount',
  'currency',
  'source_file',
  'source_hash',
  'import_time'
]

const TRANSACTION_HEADERS = [
  'id',
  'parent_id',
  'account',
  'date',
  'post_date',
  'description',
  'merchant',
  'amount',
  'currency',
  'category',
  'subcategory',
  'notes',
  'receipt_files',
  'line_items',
  'source_file',
  'source_hash',
  'import_time',
  'confidence'
]

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function writeCsvRows<T extends object>(filePath: string, headers: string[], rows: T[]): void {
  const lines = rows.map((row) => {
    const values = headers.map((header) => {
      const raw = (row as Record<string, unknown>)[header]
      return escapeCsvValue(raw === undefined || raw === null ? '' : String(raw))
    })
    return values.join(',')
  })
  const content = `${headers.join(',')}${lines.length ? '\n' + lines.join('\n') : ''}\n`
  writeFileSync(filePath, content, 'utf-8')
}

function readCsvRows(path: string): Record<string, string>[] {
  if (!existsSync(path)) return []
  const content = readFileSync(path, 'utf-8')
  if (!content.trim()) return []
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  return parsed.data.filter((row) => row && row.id)
}

export function deleteTransactionsById(dataFolder: string, ids: string[]): void {
  if (!dataFolder) throw new Error('Data folder is not configured')
  if (!ids.length) return
  ensureDataStructure(dataFolder)
  const idSet = new Set(ids)

  const ledgerPath = getDataFilePath(dataFolder, 'LEDGER')
  const ledgerRows = readCsvRows(ledgerPath).filter((row) => !idSet.has(row.id))
  if (existsSync(ledgerPath)) {
    writeCsvRows<LedgerRow>(ledgerPath, LEDGER_HEADERS, ledgerRows as unknown as LedgerRow[])
  }

  const transactionsPath = getDataFilePath(dataFolder, 'TRANSACTIONS')
  if (existsSync(transactionsPath)) {
    const txRows = readCsvRows(transactionsPath).filter((row) => !idSet.has(row.id))
    writeCsvRows<TransactionRow>(
      transactionsPath,
      TRANSACTION_HEADERS,
      txRows as unknown as TransactionRow[]
    )
  }

  const changesPath = getDataFilePath(dataFolder, 'CHANGES')
  if (existsSync(changesPath)) {
    const changeRows = readCsvRows(changesPath).filter((row) => !idSet.has(row.transaction_id))
    writeCsvRows<Record<string, string>>(
      changesPath,
      ['change_id', 'transaction_id', 'change_type', 'field', 'value', 'time'],
      changeRows
    )
  }
}

export function clearAllData(dataFolder: string): void {
  if (!dataFolder) throw new Error('Data folder is not configured')
  ensureDataStructure(dataFolder)
  const ledgerPath = getDataFilePath(dataFolder, 'LEDGER')
  const changesPath = getDataFilePath(dataFolder, 'CHANGES')
  const transactionsPath = getDataFilePath(dataFolder, 'TRANSACTIONS')
  const importLogPath = getDataFilePath(dataFolder, 'IMPORT_LOG')
  const accountsPath = getDataFilePath(dataFolder, 'ACCOUNTS')

  writeFileSync(ledgerPath, `${LEDGER_HEADERS.join(',')}\n`, 'utf-8')
  writeFileSync(changesPath, 'change_id,transaction_id,change_type,field,value,time\n', 'utf-8')
  writeFileSync(transactionsPath, `${TRANSACTION_HEADERS.join(',')}\n`, 'utf-8')
  writeFileSync(
    importLogPath,
    'import_id,source_file,source_hash,file_type,imported_at,rows_imported,rows_skipped,notes\n',
    'utf-8'
  )
  if (existsSync(accountsPath)) {
    writeFileSync(accountsPath, '[]\n', 'utf-8')
  }
}
