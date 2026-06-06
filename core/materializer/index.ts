import { readFileSync, existsSync, writeFileSync, appendFileSync } from 'fs'
import Papa from 'papaparse'
import { ensureDataStructure, getDataFilePath } from '../storage/paths'
import type { LedgerRow, TransactionRow, LineItemExplorerRow, SplitPayload } from '../types'
import type { QueryTransactionsRequest, QueryTransactionsResponse, QueryLineItemsRequest, QueryLineItemsResponse } from '../types/ipc'
import { readChanges } from '../ledger/changes'
import { getRules } from '../rules'
import { readReceiptDetail } from '../receipts/llm'
import { readReceiptIndex } from '../receipts/importer'

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function isFileEmpty(path: string): boolean {
  if (!existsSync(path)) return true
  const content = readFileSync(path, 'utf-8')
  return !content.trim()
}

function appendCsvRows<T extends object>(filePath: string, headers: string[], rows: T[]): void {
  if (!rows.length) return
  const needsHeader = isFileEmpty(filePath)
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

function parseAmount(raw: string | number | undefined): number {
  if (typeof raw === 'number') return raw
  if (!raw) return 0
  const value = String(raw).replace(/[^0-9.-]/g, '')
  const num = Number(value)
  return Number.isNaN(num) ? 0 : num
}

function readLedgerRows(ledgerPath: string): LedgerRow[] {
  if (!existsSync(ledgerPath)) return []
  const content = readFileSync(ledgerPath, 'utf-8')
  if (!content.trim()) return []
  const parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true
  })
  return parsed.data
    .filter((row) => row && row.id)
    .map((row) => ({
      id: row.id,
      account: row.account,
      date: row.date,
      post_date: row.post_date || undefined,
      description_raw: row.description_raw,
      merchant_raw: row.merchant_raw,
      amount: parseAmount(row.amount),
      currency: row.currency || 'USD',
      source_file: row.source_file,
      source_hash: row.source_hash,
      import_time: row.import_time
    }))
}

function ledgerToTransaction(row: LedgerRow): TransactionRow {
  return {
    id: row.id,
    parent_id: undefined,
    account: row.account,
    date: row.date,
    post_date: row.post_date,
    description: row.description_raw,
    merchant: row.merchant_raw,
    amount: row.amount,
    currency: row.currency,
    category: undefined,
    subcategory: undefined,
    notes: undefined,
    receipt_files: undefined,
    line_items: undefined,
    source_file: row.source_file,
    source_hash: row.source_hash,
    import_time: row.import_time,
    confidence: undefined
  }
}

function applyChanges(transactions: TransactionRow[], changes: ReturnType<typeof readChanges>): TransactionRow[] {
  if (!changes.length) return transactions
  const byId = new Map(transactions.map((tx) => [tx.id, tx]))
  const ordered = [...changes].sort((a, b) => a.time.localeCompare(b.time))

  for (const change of ordered) {
    const tx = byId.get(change.transaction_id)
    if (!tx) continue
    if (change.agent) tx.ai_edited = true
    switch (change.change_type) {
      case 'set_category':
        tx.category = change.value || undefined
        break
      case 'set_subcategory':
        tx.subcategory = change.value || undefined
        break
      case 'set_merchant':
        tx.merchant = change.value || tx.merchant
        break
      case 'set_notes':
        tx.notes = change.value || undefined
        break
      case 'link_receipt': {
        const next = new Set(
          (tx.receipt_files || '')
            .split(';')
            .map((value) => value.trim())
            .filter(Boolean)
        )
        if (change.value) {
          next.add(change.value)
        }
        tx.receipt_files = next.size > 0 ? Array.from(next).join(';') : undefined
        break
      }
      case 'unlink_receipt': {
        const next = new Set(
          (tx.receipt_files || '')
            .split(';')
            .map((value) => value.trim())
            .filter(Boolean)
        )
        if (change.value) {
          next.delete(change.value)
        }
        tx.receipt_files = next.size > 0 ? Array.from(next).join(';') : undefined
        break
      }
      case 'split': {
        let parsed: { splits?: SplitPayload[] }
        try {
          parsed = JSON.parse(change.value) as { splits?: SplitPayload[] }
        } catch {
          break
        }
        const splits = Array.isArray(parsed.splits) ? parsed.splits : []
        if (splits.length < 2) break

        const validSplits = splits.filter((split) => split.id && Number.isFinite(split.amount) && split.amount !== 0)
        if (validSplits.length !== splits.length) break

        const cents = (value: number) => Math.round(value * 100)
        const splitTotal = validSplits.reduce((sum, split) => sum + cents(split.amount), 0)
        if (splitTotal !== cents(tx.amount)) break

        byId.delete(tx.id)
        for (const split of validSplits) {
          const receiptFiles = split.receipt_id ? split.receipt_id : tx.receipt_files
          byId.set(`${tx.id}:split:${split.id}`, {
            ...tx,
            id: `${tx.id}:split:${split.id}`,
            parent_id: tx.id,
            amount: split.amount,
            category: split.category || tx.category,
            subcategory: split.subcategory || tx.subcategory,
            notes: split.notes || tx.notes,
            receipt_files: receiptFiles,
            line_items: split.line_item_id ? JSON.stringify([split.line_item_id]) : tx.line_items
          })
        }
        break
      }
      default:
        break
    }
  }

  return Array.from(byId.values())
}

function applyCategoryRules(transactions: TransactionRow[], dataFolder: string): TransactionRow[] {
  const rules = getRules(dataFolder)
    .filter((rule) => rule.enabled && rule.match_value)
    .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))

  if (rules.length === 0) return transactions

  for (const tx of transactions) {
    if (tx.category) continue
    const merchant = (tx.merchant || '').toLowerCase()
    const description = (tx.description || '').toLowerCase()
    const matched = rules.find((rule) => {
      const needle = rule.match_value.toLowerCase()
      if (rule.match_type === 'merchant_contains') {
        return merchant.includes(needle)
      }
      if (rule.match_type === 'description_contains') {
        return description.includes(needle)
      }
      if (rule.match_type === 'merchant_or_description_contains') {
        return merchant.includes(needle) || description.includes(needle)
      }
      if (rule.match_type === 'merchant_regex') {
        try {
          return new RegExp(rule.match_value, 'i').test(merchant)
        } catch {
          return false
        }
      }
      return false
    })
    if (matched) {
      tx.category = matched.category || undefined
      tx.subcategory = matched.subcategory || undefined
    }
  }
  return transactions
}

export function materializeTransactions(dataFolder: string): void {
  if (!dataFolder) {
    throw new Error('Data folder is not configured')
  }
  ensureDataStructure(dataFolder)
  const ledgerPath = getDataFilePath(dataFolder, 'LEDGER')
  const transactionsPath = getDataFilePath(dataFolder, 'TRANSACTIONS')
  const changes = readChanges(dataFolder)

  const ledgerRows = readLedgerRows(ledgerPath)
  const baseRows = ledgerRows.map(ledgerToTransaction)
  const withRules = applyCategoryRules(baseRows, dataFolder)
  const transactionRows = applyChanges(withRules, changes)

  if (existsSync(transactionsPath)) {
    writeFileSync(transactionsPath, '', 'utf-8')
  }

  appendCsvRows(transactionsPath, ['id', 'parent_id', 'account', 'date', 'post_date', 'description', 'merchant', 'amount', 'currency', 'category', 'subcategory', 'notes', 'receipt_files', 'line_items', 'source_file', 'source_hash', 'import_time', 'confidence', 'ai_edited'], transactionRows)
}

function readTransactionRows(dataFolder: string): TransactionRow[] {
  const transactionsPath = getDataFilePath(dataFolder, 'TRANSACTIONS')
  if (!existsSync(transactionsPath)) {
    materializeTransactions(dataFolder)
  }
  if (!existsSync(transactionsPath)) return []
  const content = readFileSync(transactionsPath, 'utf-8')
  if (!content.trim()) return []
  let parsed = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true
  })
  if (!parsed.meta.fields || !parsed.meta.fields.includes('id')) {
    materializeTransactions(dataFolder)
    const refreshed = readFileSync(transactionsPath, 'utf-8')
    parsed = Papa.parse<Record<string, string>>(refreshed, {
      header: true,
      skipEmptyLines: true
    })
  }
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
      amount: parseAmount(row.amount),
      currency: row.currency || 'USD',
      category: row.category || undefined,
      subcategory: row.subcategory || undefined,
      notes: row.notes || undefined,
      receipt_files: row.receipt_files || undefined,
      line_items: row.line_items || undefined,
      source_file: row.source_file,
      source_hash: row.source_hash,
      import_time: row.import_time,
      confidence: row.confidence ? parseAmount(row.confidence) : undefined,
      ai_edited: row.ai_edited === 'true' ? true : undefined
    }))
}

function applyFilters(rows: TransactionRow[], req: QueryTransactionsRequest): TransactionRow[] {
  const { filters } = req
  if (!filters) return rows

  return rows.filter((row) => {
    if (filters.search) {
      const needle = filters.search.toLowerCase()
      const haystack = `${row.merchant} ${row.description} ${row.notes ?? ''}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    if (filters.dateRange) {
      if (filters.dateRange.start && row.date < filters.dateRange.start) return false
      if (filters.dateRange.end && row.date > filters.dateRange.end) return false
    }
    if (filters.amountRange) {
      if (filters.amountRange.min !== undefined && row.amount < filters.amountRange.min) return false
      if (filters.amountRange.max !== undefined && row.amount > filters.amountRange.max) return false
    }
    if (filters.categories && filters.categories.length > 0) {
      if (!row.category || !filters.categories.includes(row.category)) return false
    }
    if (filters.accounts && filters.accounts.length > 0) {
      if (!filters.accounts.includes(row.account)) return false
    }
    if (filters.hasReceipt !== undefined) {
      const hasReceipt = !!row.receipt_files
      if (filters.hasReceipt !== hasReceipt) return false
    }
    if (filters.uncategorized) {
      if (row.category) return false
    }
    if (filters.merchantContains) {
      if (!row.merchant?.toLowerCase().includes(filters.merchantContains.toLowerCase())) return false
    }
    return true
  })
}

function applySorting(rows: TransactionRow[], req: QueryTransactionsRequest): TransactionRow[] {
  const sortBy = req.sortBy ?? 'date'
  const sortOrder = req.sortOrder ?? 'desc'
  const sorted = [...rows].sort((a, b) => {
    const av = a[sortBy]
    const bv = b[sortBy]
    if (typeof av === 'number' && typeof bv === 'number') return av - bv
    return String(av ?? '').localeCompare(String(bv ?? ''))
  })
  return sortOrder === 'desc' ? sorted.reverse() : sorted
}

export function queryTransactions(dataFolder: string, req: QueryTransactionsRequest): QueryTransactionsResponse {
  if (!dataFolder) {
    throw new Error('Data folder is not configured')
  }
  const rows = readTransactionRows(dataFolder)
  const filtered = applyFilters(rows, req)
  const sorted = applySorting(filtered, req)

  const offset = req.offset ?? 0
  const limit = req.limit ?? 200
  const page = sorted.slice(offset, offset + limit)

  const totalAmount = sorted.reduce((sum, tx) => sum + tx.amount, 0)

  return {
    transactions: page,
    total: sorted.length,
    totalAmount
  }
}

export function queryLineItems(dataFolder: string, req: QueryLineItemsRequest): QueryLineItemsResponse {
  if (!dataFolder) {
    throw new Error('Data folder is not configured')
  }
  const rows = readTransactionRows(dataFolder)
  const items: LineItemExplorerRow[] = []

  for (const tx of rows) {
    const receiptIds = tx.receipt_files
      ? tx.receipt_files
          .split(';')
          .map((value) => value.trim())
          .filter(Boolean)
      : []

    let addedLineItems = 0

    for (const receiptId of receiptIds) {
      const detail = readReceiptDetail(dataFolder, receiptId)
      if (!detail?.line_items?.length) continue
      detail.line_items.forEach((item, idx) => {
        const itemCategory = item.category_hint || tx.subcategory || tx.category
        items.push({
          id: `${receiptId}:${idx}`,
          transaction_id: tx.id,
          receipt_id: receiptId,
          date: tx.date,
          merchant: tx.merchant,
          description: tx.description,
          item: item.description,
          quantity: item.quantity ?? undefined,
          unit_price: item.unit_price ?? undefined,
          item_total: item.total,
          transaction_amount: tx.amount,
          account: tx.account,
          category: tx.category,
          subcategory: tx.subcategory,
          notes: tx.notes,
          item_category: itemCategory || undefined
        })
        addedLineItems += 1
      })
    }

    if (addedLineItems === 0) {
      const fallbackCategory = tx.subcategory || tx.category
      items.push({
        id: `tx:${tx.id}`,
        transaction_id: tx.id,
        receipt_id: '',
        date: tx.date,
        merchant: tx.merchant,
        description: tx.description,
        item: tx.description || tx.merchant || 'Transaction',
        quantity: 1,
        unit_price: tx.amount,
        item_total: tx.amount,
        transaction_amount: tx.amount,
        account: tx.account,
        category: tx.category,
        subcategory: tx.subcategory,
        notes: tx.notes,
        item_category: fallbackCategory
      })
    }
  }

  // Second pass: unlinked receipts — receipts that have no entry in any transaction's receipt_files
  const coveredReceiptIds = new Set(
    rows.flatMap((tx) =>
      tx.receipt_files
        ? tx.receipt_files
            .split(';')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    )
  )
  const allReceiptIndexRows = readReceiptIndex(dataFolder)
  for (const indexRow of allReceiptIndexRows) {
    if (coveredReceiptIds.has(indexRow.receipt_id)) continue
    const detail = readReceiptDetail(dataFolder, indexRow.receipt_id)
    if (!detail?.line_items?.length) continue
    detail.line_items.forEach((item, idx) => {
      items.push({
        id: `unlinked:${indexRow.receipt_id}:${idx}`,
        transaction_id: '',
        receipt_id: indexRow.receipt_id,
        date: detail.date || indexRow.date || '',
        merchant: detail.merchant || indexRow.merchant || '',
        description: '',
        item: item.description,
        quantity: item.quantity ?? undefined,
        unit_price: item.unit_price ?? undefined,
        item_total: item.total,
        transaction_amount: detail.total ?? 0,
        account: '',
        category: undefined,
        subcategory: undefined,
        notes: undefined,
        item_category: item.category_hint || undefined,
        is_unlinked: true
      })
    })
  }

  const filtered = items.filter((row) => {
    const { filters } = req
    if (!filters) return true
    if (filters.linkedStatus === 'linked' && row.is_unlinked) return false
    if (filters.linkedStatus === 'unlinked' && !row.is_unlinked) return false
    if (filters.search) {
      const needle = filters.search.toLowerCase()
      const haystack = `${row.item} ${row.description} ${row.merchant}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    if (filters.category) {
      if (!row.item_category || row.item_category !== filters.category) return false
    }
    if (filters.merchant) {
      if (!row.merchant?.toLowerCase().includes(filters.merchant.toLowerCase())) return false
    }
    if (filters.dateRange) {
      if (filters.dateRange.start && row.date < filters.dateRange.start) return false
      if (filters.dateRange.end && row.date > filters.dateRange.end) return false
    }
    if (filters.amountRange) {
      if (filters.amountRange.min !== undefined && row.item_total < filters.amountRange.min) return false
      if (filters.amountRange.max !== undefined && row.item_total > filters.amountRange.max) return false
    }
    return true
  })

  const sortBy = req.sortBy ?? 'date'
  const sortOrder = req.sortOrder ?? 'desc'
  const sorted = [...filtered].sort((a, b) => {
    const av = sortBy === 'total' ? a.item_total : sortBy === 'item' ? a.item : sortBy === 'category' ? a.item_category || '' : sortBy === 'merchant' ? a.merchant : a.date
    const bv = sortBy === 'total' ? b.item_total : sortBy === 'item' ? b.item : sortBy === 'category' ? b.item_category || '' : sortBy === 'merchant' ? b.merchant : b.date
    if (typeof av === 'number' && typeof bv === 'number') return av - bv
    return String(av ?? '').localeCompare(String(bv ?? ''))
  })

  if (sortOrder === 'desc') sorted.reverse()

  const totalAmount = sorted.reduce((sum, row) => sum + (row.item_total || 0), 0)

  return {
    items: sorted,
    total: sorted.length,
    totalAmount
  }
}
