import { readFileSync, existsSync, appendFileSync, writeFileSync } from 'fs'
import { basename } from 'path'
import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'
import { parse, parseISO, isValid, format } from 'date-fns'
import { ensureDataStructure, getDataFilePath } from '../utils/paths'
import { hashFile } from '../utils/file-hash'
import { moveFilesToImported } from '../ipc/file-system'
import { upsertAccount } from '../accounts'
import type { ImportStatementsRequest } from '../../shared/types/ipc'
import type {
  ImportResult,
  LedgerRow,
  ImportLogRow,
  ImportError,
  AccountInfo
} from '../../shared/types'

const DATE_FORMATS = ['yyyy-MM-dd', 'MM/dd/yyyy', 'M/d/yyyy', 'MM/dd/yy', 'M/d/yy', 'dd/MM/yyyy']

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function parseAccountFromFilename(filePath: string): {
  accountNumber?: string
  accountType?: string
  bankName?: string
  period?: string
} {
  const name = basename(filePath)
  const withoutExt = name.replace(/\.[^/.]+$/, '')
  const parts = withoutExt
    .split('_')
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 3) return {}

  const accountNumber = parts[0] || undefined
  const accountType = parts[1] || undefined
  const bankName = parts[2] || undefined
  const period = parts.slice(3).join('_') || undefined

  return { accountNumber, accountType, bankName, period }
}

function parseDateToISO(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  const iso = parseISO(trimmed)
  if (isValid(iso)) return format(iso, 'yyyy-MM-dd')

  for (const fmt of DATE_FORMATS) {
    const parsed = parse(trimmed, fmt, new Date())
    if (isValid(parsed)) return format(parsed, 'yyyy-MM-dd')
  }

  return null
}

function parseAmount(raw: string): number | null {
  if (raw === undefined || raw === null) return null
  let value = raw.toString().trim()
  if (!value) return null

  // Handle parentheses for negatives
  let negative = false
  if (value.startsWith('(') && value.endsWith(')')) {
    negative = true
    value = value.slice(1, -1)
  }

  // Remove currency symbols and commas
  value = value.replace(/[^0-9.-]/g, '')
  if (!value) return null

  const num = Number(value)
  if (Number.isNaN(num)) return null
  return negative ? -Math.abs(num) : num
}

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function appendCsvRows<T extends object>(
  filePath: string,
  headers: string[],
  rows: T[]
): void {
  if (!rows.length) return

  const needsHeader = !existsSync(filePath)
  if (needsHeader) {
    writeFileSync(filePath, `${headers.join(',')}\n`, 'utf-8')
  }

  const lines = rows.map((row) => {
    const values = headers.map((header) => {
      const raw = (row as Record<string, unknown>)[header]
      return escapeCsvValue(raw === undefined || raw === null ? '' : String(raw))
    })
    return values.join(',')
  })
  appendFileSync(filePath, `${lines.join('\n')}\n`, 'utf-8')
}

export function detectColumnMapping(headers: string[]): {
  date?: string
  post_date?: string
  amount?: string
  description?: string
  merchant?: string
  debit?: string
  credit?: string
} {
  const normalized = headers.map((h) => [normalizeHeader(h), h] as const)
  const find = (candidates: string[]) =>
    normalized.find(([key]) => candidates.includes(key))?.[1]

  return {
    date: find(['date', 'transactiondate', 'transdate']),
    post_date: find(['postdate', 'posteddate', 'postingdate']),
    amount: find(['amount', 'amt', 'value']),
    description: find(['description', 'memo', 'details', 'narrative']),
    merchant: find(['merchant', 'payee', 'name']),
    debit: find(['debit', 'withdrawal', 'charge']),
    credit: find(['credit', 'deposit', 'payment'])
  }
}

function readImportLogHashes(importLogPath: string): Set<string> {
  if (!existsSync(importLogPath)) return new Set()
  const content = readFileSync(importLogPath, 'utf-8')
  if (!content.trim()) return new Set()
  const parsed = Papa.parse<Record<string, string>>(content, { header: true })
  const hashes = new Set<string>()
  for (const row of parsed.data) {
    if (row?.source_hash) hashes.add(row.source_hash)
  }
  return hashes
}

export function getCsvHeadersForFile(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf-8')
  const parsed = Papa.parse(content, { header: true })
  return parsed.meta.fields ?? []
}

export function getCsvPreviewForFile(
  filePath: string,
  rows: number = 10
): { headers: string[]; rows: Record<string, string>[] } {
  const content = readFileSync(filePath, 'utf-8')
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true
  })
  const headers = parsed.meta.fields ?? []
  return {
    headers,
    rows: parsed.data.slice(0, rows)
  }
}

export function getCsvMappingForFile(filePath: string): {
  mapping: ReturnType<typeof detectColumnMapping>
  ignoredHeaders: string[]
} {
  const headers = getCsvHeadersForFile(filePath)
  const mapping = detectColumnMapping(headers)
  const used = new Set(
    Object.values(mapping)
      .filter(Boolean)
      .map((v) => String(v))
  )
  const ignoredHeaders = headers.filter((h) => !used.has(h))
  return { mapping, ignoredHeaders }
}

export function getCsvStatsForFile(filePath: string): {
  rowCount: number
  dateMin?: string
  dateMax?: string
} {
  const content = readFileSync(filePath, 'utf-8')
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true
  })
  const headers = parsed.meta.fields ?? []
  const mapping = detectColumnMapping(headers)
  const dateHeader = mapping.date
  let dateMin: string | undefined
  let dateMax: string | undefined

  for (const row of parsed.data) {
    if (!dateHeader) break
    const raw = row[dateHeader]
    if (!raw) continue
    const iso = parseDateToISO(raw)
    if (!iso) continue
    if (!dateMin || iso < dateMin) dateMin = iso
    if (!dateMax || iso > dateMax) dateMax = iso
  }

  return {
    rowCount: parsed.data.length,
    dateMin,
    dateMax
  }
}

type InternalColumnMapping = {
  date?: string
  post_date?: string
  amount?: string
  description?: string
  merchant?: string
  debit?: string
  credit?: string
}

function normalizeMapping(
  mapping: ImportStatementsRequest['columnMapping'] | undefined,
  headers: string[]
): InternalColumnMapping {
  if (!mapping) return detectColumnMapping(headers)
  return {
    date: mapping.date,
    amount: mapping.amount,
    description: mapping.description,
    merchant: mapping.merchant,
    post_date: mapping.post_date
  }
}

function buildLedgerRows(
  rows: Record<string, string>[],
  mapping: InternalColumnMapping,
  account: string,
  sourceFile: string,
  sourceHash: string
): { ledgerRows: LedgerRow[]; errors: ImportError[] } {
  const ledgerRows: LedgerRow[] = []
  const errors: ImportError[] = []
  const importTime = new Date().toISOString()

  rows.forEach((row, index) => {
    const dateRaw = mapping.date ? row[mapping.date] : undefined
    const date = parseDateToISO(dateRaw ?? '')
    if (!date) {
      errors.push({ row: index + 2, message: 'Invalid or missing date', data: row })
      return
    }

    const postDateRaw = mapping.post_date ? row[mapping.post_date] : undefined
    const postDate = postDateRaw ? parseDateToISO(postDateRaw) ?? undefined : undefined

    let amount: number | null = null
    if (mapping.amount) {
      amount = parseAmount(row[mapping.amount])
    } else if (mapping.debit || mapping.credit) {
      const debit = mapping.debit ? parseAmount(row[mapping.debit]) ?? 0 : 0
      const credit = mapping.credit ? parseAmount(row[mapping.credit]) ?? 0 : 0
      amount = credit - debit
    }

    if (amount === null) {
      errors.push({ row: index + 2, message: 'Invalid or missing amount', data: row })
      return
    }

    const descriptionRaw = mapping.description ? row[mapping.description] : ''
    const merchantRaw = mapping.merchant ? row[mapping.merchant] : descriptionRaw

    ledgerRows.push({
      id: uuidv4(),
      account,
      date,
      post_date: postDate,
      description_raw: descriptionRaw ?? '',
      merchant_raw: merchantRaw ?? '',
      amount,
      currency: 'USD',
      source_file: sourceFile,
      source_hash: sourceHash,
      import_time: importTime
    })
  })

  return { ledgerRows, errors }
}

export async function importStatementFiles(
  dataFolder: string,
  req: ImportStatementsRequest
): Promise<ImportResult[]> {
  if (!dataFolder) {
    throw new Error('Data folder is not configured')
  }
  ensureDataStructure(dataFolder)
  const ledgerPath = getDataFilePath(dataFolder, 'LEDGER')
  const importLogPath = getDataFilePath(dataFolder, 'IMPORT_LOG')
  const existingHashes = readImportLogHashes(importLogPath)

  const results: ImportResult[] = []
  const fallbackAccount = req.account || 'Default'

  for (const filePath of req.paths) {
    const sourceHash = hashFile(filePath)
    const sourceFile = basename(filePath)
    const importId = uuidv4()

    if (existingHashes.has(sourceHash)) {
      results.push({
        import_id: importId,
        source_file: sourceFile,
        rows_imported: 0,
        rows_skipped: 0,
        errors: [],
        duplicates: [sourceHash]
      })
      continue
    }

    const content = readFileSync(filePath, 'utf-8')
    const parsed = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: true
    })

    const headers = parsed.meta.fields ?? []
    const mapping = normalizeMapping(req.columnMapping, headers)

    const accountMeta = parseAccountFromFilename(filePath)
    const accountNumber = accountMeta.accountNumber || fallbackAccount
    const { ledgerRows, errors } = buildLedgerRows(
      parsed.data,
      mapping,
      accountNumber,
      sourceFile,
      sourceHash
    )

    appendCsvRows(
      ledgerPath,
      [
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
      ],
      ledgerRows
    )

    const importLogRow: ImportLogRow = {
      import_id: importId,
      source_file: sourceFile,
      source_hash: sourceHash,
      file_type: 'csv',
      imported_at: new Date().toISOString(),
      rows_imported: ledgerRows.length,
      rows_skipped: errors.length,
      notes: errors.length ? 'Some rows skipped during import' : undefined
    }

    appendCsvRows(importLogPath, [
      'import_id',
      'source_file',
      'source_hash',
      'file_type',
      'imported_at',
      'rows_imported',
      'rows_skipped',
      'notes'
    ], [importLogRow])

    results.push({
      import_id: importId,
      source_file: sourceFile,
      rows_imported: ledgerRows.length,
      rows_skipped: errors.length,
      errors,
      duplicates: []
    })

    if (accountNumber) {
      const accountInfo: AccountInfo = {
        accountNumber,
        accountType: accountMeta.accountType,
        bankName: accountMeta.bankName,
        period: accountMeta.period,
        sourceFiles: [sourceFile],
        lastImportedAt: new Date().toISOString()
      }
      upsertAccount(dataFolder, accountInfo)
    }
  }

  // Move files after successful processing (including partial skips)
  moveFilesToImported(dataFolder, req.paths, 'statement')

  return results
}
