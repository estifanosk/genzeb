import { existsSync, readFileSync, writeFileSync, appendFileSync, copyFileSync, mkdirSync } from 'fs'
import { join, extname, basename } from 'path'
import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'
import { ensureDataStructure, getDataDirPath, getDataFilePath } from '../storage/paths'
import { hashBinaryFile } from '../storage/file-hash'
import { moveToImported } from '../storage/imported-files'
import type { ReceiptIndexRow, TransactionRow, ChangeRow } from '../types'
import type { IngestReceiptsRequest, IngestReceiptsResponse, ReceiptMatchPreview } from '../types/ipc'
import { appendChangeRow } from '../ledger/changes'

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function appendCsvRow(filePath: string, headers: string[], row: Record<string, unknown>): void {
  const needsHeader = !existsSync(filePath) || !readFileSync(filePath, 'utf-8').trim()
  if (needsHeader) {
    writeFileSync(filePath, `${headers.join(',')}\n`, 'utf-8')
  }
  const values = headers.map((header) => {
    const raw = row[header]
    return escapeCsvValue(raw === undefined || raw === null ? '' : String(raw))
  })
  appendFileSync(filePath, `${values.join(',')}\n`, 'utf-8')
}

function parseReceiptMetadataFromFilename(filePath: string): {
  date?: string
  amount?: number
  merchant?: string
} {
  const name = basename(filePath)
  const withoutExt = name.replace(/\.[^/.]+$/, '')

  let date: string | undefined
  let amount: number | undefined

  const dateMatch = withoutExt.match(/(\d{4}-\d{2}-\d{2})/) || withoutExt.match(/(\d{8})/)
  if (dateMatch) {
    const raw = dateMatch[1]
    if (raw.includes('-')) {
      date = raw
    } else if (raw.length === 8) {
      date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
    }
  }

  const amountMatch = withoutExt.match(/(\d+[.,]\d{2})/g)
  if (amountMatch && amountMatch.length > 0) {
    const raw = amountMatch[amountMatch.length - 1].replace(',', '.')
    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) amount = parsed
  }

  let merchant: string | undefined = withoutExt
    .replace(/\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\d{8}/g, '')
    .replace(/\d+[.,]\d{2}/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!merchant) merchant = undefined

  return { date, amount, merchant }
}

function loadTransactions(dataFolder: string): TransactionRow[] {
  const transactionsPath = getDataFilePath(dataFolder, 'TRANSACTIONS')
  if (!existsSync(transactionsPath)) return []
  const content = readFileSync(transactionsPath, 'utf-8')
  if (!content.trim()) return []
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  return parsed.data
    .filter((row) => row && row.id)
    .map((row) => ({
      id: row.id,
      parent_id: row.parent_id || undefined,
      account: row.account,
      date: row.date,
      post_date: row.post_date || undefined,
      description: row.description,
      merchant: row.merchant,
      amount: Number(row.amount),
      currency: row.currency || 'USD',
      category: row.category || undefined,
      subcategory: row.subcategory || undefined,
      notes: row.notes || undefined,
      receipt_files: row.receipt_files || undefined,
      line_items: row.line_items || undefined,
      source_file: row.source_file,
      source_hash: row.source_hash,
      import_time: row.import_time,
      confidence: row.confidence ? Number(row.confidence) : undefined
    }))
}

function dateDiffDays(a: string, b: string): number {
  const da = new Date(a)
  const db = new Date(b)
  const diff = Math.abs(da.getTime() - db.getTime())
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function computeMatches(
  transactions: TransactionRow[],
  metadata: { date?: string; amount?: number; merchant?: string },
  dayWindow: number,
  tolerance: number
) {
  if (!metadata.date || metadata.amount === undefined) return []

  const receiptAmount = Math.abs(metadata.amount)

  const candidates = transactions
    .map((tx) => {
      const dateDiff = dateDiffDays(tx.date, metadata.date!)
      const amountDiff = Math.abs(Math.abs(tx.amount) - receiptAmount)
      if (dateDiff > dayWindow) return null
      if (amountDiff > tolerance) return null
      const score = 1 - Math.min(1, dateDiff / dayWindow) * 0.3 - Math.min(1, amountDiff / tolerance) * 0.7
      return {
        transactionId: tx.id,
        date: tx.date,
        amount: tx.amount,
        merchant: tx.merchant,
        score
      }
    })
    .filter(Boolean) as Array<{ transactionId: string; date: string; amount: number; merchant: string; score: number }>

  return candidates.sort((a, b) => b.score - a.score)
}

export function getReceiptMatchPreview(
  dataFolder: string,
  filePath: string,
  dayWindow: number = 3,
  tolerance: number = 1
): ReceiptMatchPreview {
  if (!dataFolder) throw new Error('Data folder is not configured')
  ensureDataStructure(dataFolder)
  const transactions = loadTransactions(dataFolder)
  const metadata = parseReceiptMetadataFromFilename(filePath)
  const matches = computeMatches(transactions, metadata, dayWindow, tolerance)
  return {
    hasTransactions: transactions.length > 0,
    metadata,
    matches
  }
}

export function getReceiptMatchPreviewFromData(
  dataFolder: string,
  metadata: { date?: string; amount?: number; merchant?: string },
  dayWindow: number = 3,
  tolerance: number = 1
): ReceiptMatchPreview {
  if (!dataFolder) throw new Error('Data folder is not configured')
  ensureDataStructure(dataFolder)
  const transactions = loadTransactions(dataFolder)
  const matches = computeMatches(transactions, metadata, dayWindow, tolerance)
  return {
    hasTransactions: transactions.length > 0,
    metadata,
    matches
  }
}

export function readReceiptIndex(dataFolder: string): ReceiptIndexRow[] {
  const indexPath = getDataFilePath(dataFolder, 'RECEIPTS_INDEX')
  if (!existsSync(indexPath)) return []
  const content = readFileSync(indexPath, 'utf-8')
  if (!content.trim()) return []
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  return parsed.data
    .filter((row) => row && row.receipt_id)
    .map((row) => ({
      receipt_id: row.receipt_id,
      file_path: row.file_path,
      receipt_type: (row.receipt_type || 'image') as ReceiptIndexRow['receipt_type'],
      merchant: row.merchant || undefined,
      date: row.date || undefined,
      total: row.total ? Number(row.total) : undefined,
      currency: row.currency || undefined,
      source_hash: row.source_hash,
      ocr_status: (row.ocr_status || 'pending') as ReceiptIndexRow['ocr_status'],
      created_at: row.created_at
    }))
}

export function getReceiptPreviewData(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase()
  const imageTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.svg': 'image/svg+xml'
  }
  const mime = imageTypes[ext] || (ext === '.pdf' ? 'application/pdf' : undefined)
  if (!mime) return null
  const data = readFileSync(filePath)
  return `data:${mime};base64,${data.toString('base64')}`
}

export function ingestReceipts(
  dataFolder: string,
  req: IngestReceiptsRequest
): IngestReceiptsResponse {
  if (!dataFolder) throw new Error('Data folder is not configured')
  ensureDataStructure(dataFolder)

  const transactions = loadTransactions(dataFolder)
  const hasTransactions = transactions.length > 0
  const dayWindow = req.dayWindow ?? 3
  const tolerance = req.tolerance ?? 1

  const receipts: ReceiptIndexRow[] = []
  let linked = 0
  let unmatched = 0

  for (const filePath of req.paths) {
    const receiptId = uuidv4()
    const ext = extname(filePath)
    const receiptType = ext === '.pdf' ? 'pdf' : 'image'
    const receiptDir = getDataDirPath(dataFolder, 'RECEIPTS')
    if (!existsSync(receiptDir)) mkdirSync(receiptDir, { recursive: true })
    const destPath = join(receiptDir, `${receiptId}${ext || ''}`)

    copyFileSync(filePath, destPath)
    const sourceHash = hashBinaryFile(filePath)

    const metadata = req.matchMetadata || parseReceiptMetadataFromFilename(filePath)
    const receiptRow: ReceiptIndexRow = {
      receipt_id: receiptId,
      file_path: destPath,
      receipt_type: receiptType,
      merchant: metadata.merchant,
      date: metadata.date,
      total: metadata.amount,
      currency: 'USD',
      source_hash: sourceHash,
      ocr_status: 'pending',
      created_at: new Date().toISOString()
    }

    const indexPath = getDataFilePath(dataFolder, 'RECEIPTS_INDEX')
    appendCsvRow(indexPath, [
      'receipt_id',
      'file_path',
      'receipt_type',
      'merchant',
      'date',
      'total',
      'currency',
      'source_hash',
      'ocr_status',
      'created_at'
    ], receiptRow as unknown as Record<string, unknown>)

    receipts.push(receiptRow)

    if (req.mode === 'link' && hasTransactions) {
      const forcedMatchId = req.matchTransactionId
      const forcedMatch = forcedMatchId
        ? transactions.find((tx) => tx.id === forcedMatchId)
        : undefined
      const matches = computeMatches(transactions, metadata, dayWindow, tolerance)
      const best =
        (forcedMatch
          ? {
              transactionId: forcedMatch.id,
              date: forcedMatch.date,
              amount: forcedMatch.amount,
              merchant: forcedMatch.merchant,
              score: 1
            }
          : undefined) || matches[0]
      if (best) {
        const linksPath = getDataFilePath(dataFolder, 'LINKS')
        appendCsvRow(linksPath, [
          'link_id',
          'transaction_id',
          'receipt_id',
          'line_item_id',
          'amount',
          'confidence',
          'notes'
        ], {
          link_id: uuidv4(),
          transaction_id: best.transactionId,
          receipt_id: receiptId,
          line_item_id: '',
          amount: metadata.amount ?? '',
          confidence: Math.round(best.score * 100) / 100,
          notes: 'auto-linked'
        })

        const change: Omit<ChangeRow, 'change_id' | 'time'> = {
          transaction_id: best.transactionId,
          change_type: 'link_receipt',
          value: receiptId
        }
        appendChangeRow(dataFolder, change)
        linked += 1
      } else {
        unmatched += 1
      }
    } else {
      unmatched += 1
    }

    moveToImported(dataFolder, filePath, 'receipt')
  }

  return { receipts, linked, unmatched }
}
