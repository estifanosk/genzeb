import { ipcMain, type IpcMain } from 'electron'
import { IPC_CHANNELS } from '@core/types/ipc'
import {
  selectDataFolder,
  scanInbox,
  ensureDataFolderStructure,
  openInFileManager,
  getInboxPaths
} from './file-system'
import { getSettings, updateSettings, loadSettings } from './settings'
import { buildTransactionCsv } from './transaction-csv'
import {
  importStatementFiles,
  readImportLog,
  getCsvHeadersForFile,
  getCsvPreviewForFile,
  getCsvMappingForFile,
  getCsvStatsForFile
} from '@core/importer/statement-importer'
import { materializeTransactions, queryTransactions, queryLineItems } from '@core/materializer'
import { deleteTransactionsById, clearAllData } from '@core/data-admin'
import { getAccounts } from '@core/accounts'
import { appendChangeRow, readChanges } from '@core/ledger/changes'
import {
  ingestReceipts,
  readReceiptIndex,
  getReceiptMatchPreview,
  getReceiptMatchPreviewFromData,
  getReceiptPreviewData,
  readLinks,
  writeLink,
  removeLink,
  getCandidatesForReceipt
} from '@core/receipts/importer'
import {
  runReceiptLlmExtract,
  saveReceiptDetail as saveReceiptDetailFile,
  readReceiptDetail,
  updateOcrStatus
} from '@core/receipts/llm'
import { getCategories, saveCategories, getRules, saveRule, deleteRule } from '@core/rules'
import { categorizeTransactionsLlm } from '@core/llm/categorize'
import type { AppSettings } from '@core/types'

export function registerAllHandlers(_ipcMain: IpcMain): void {
  // Initialize settings on startup
  loadSettings()

  // === File System Handlers ===

  ipcMain.handle(IPC_CHANNELS.SELECT_DATA_FOLDER, async () => {
    return selectDataFolder()
  })

  ipcMain.handle(IPC_CHANNELS.SCAN_INBOX, async () => {
    const settings = getSettings()
    return scanInbox(settings.dataFolder)
  })

  ipcMain.handle(IPC_CHANNELS.ENSURE_DATA_STRUCTURE, async () => {
    const settings = getSettings()
    ensureDataFolderStructure(settings.dataFolder)
  })

  ipcMain.handle(IPC_CHANNELS.OPEN_FOLDER, async (_, path: string) => {
    await openInFileManager(path)
  })

  ipcMain.handle(IPC_CHANNELS.GET_INBOX_PATHS, async () => {
    const settings = getSettings()
    return getInboxPaths(settings.dataFolder)
  })

  // === Settings Handlers ===

  ipcMain.handle(IPC_CHANNELS.GET_SETTINGS, async () => {
    return getSettings()
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_SETTINGS, async (_, partial: Partial<AppSettings>) => {
    return updateSettings(partial)
  })

  // === Import Handlers (placeholder) ===

  ipcMain.handle(IPC_CHANNELS.IMPORT_STATEMENTS, async (_, _req) => {
    const settings = getSettings()
    const results = await importStatementFiles(settings.dataFolder, _req)
    if (settings.autoMaterialize) {
      materializeTransactions(settings.dataFolder)
    }
    return results
  })

  ipcMain.handle(IPC_CHANNELS.GET_IMPORT_LOG, async () => {
    const settings = getSettings()
    if (!settings.dataFolder) return []
    return readImportLog(settings.dataFolder)
  })

  ipcMain.handle(IPC_CHANNELS.GET_CSV_HEADERS, async (_, _path: string) => {
    return getCsvHeadersForFile(_path)
  })

  ipcMain.handle(IPC_CHANNELS.GET_CSV_PREVIEW, async (_, _path: string, rows?: number) => {
    return getCsvPreviewForFile(_path, rows)
  })

  ipcMain.handle(IPC_CHANNELS.GET_CSV_MAPPING, async (_, _path: string) => {
    return getCsvMappingForFile(_path)
  })

  ipcMain.handle(IPC_CHANNELS.GET_CSV_STATS, async (_, _path: string) => {
    return getCsvStatsForFile(_path)
  })

  // === Ledger Handlers (placeholder) ===

  ipcMain.handle(IPC_CHANNELS.APPEND_CHANGE, async (_, _change) => {
    const settings = getSettings()
    appendChangeRow(settings.dataFolder, _change)
    if (settings.autoMaterialize) {
      materializeTransactions(settings.dataFolder)
    }
  })

  ipcMain.handle(IPC_CHANNELS.GET_CHANGES, async () => {
    const settings = getSettings()
    if (!settings.dataFolder) return []
    return readChanges(settings.dataFolder)
  })

  // === Materializer Handlers (placeholder) ===

  ipcMain.handle(IPC_CHANNELS.MATERIALIZE, async () => {
    const settings = getSettings()
    materializeTransactions(settings.dataFolder)
  })

  ipcMain.handle(IPC_CHANNELS.QUERY_TRANSACTIONS, async (_, _req) => {
    const settings = getSettings()
    return queryTransactions(settings.dataFolder, _req)
  })

  ipcMain.handle(IPC_CHANNELS.QUERY_LINE_ITEMS, async (_, _req) => {
    const settings = getSettings()
    return queryLineItems(settings.dataFolder, _req)
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_TRANSACTIONS, async (_, ids: string[]) => {
    const settings = getSettings()
    deleteTransactionsById(settings.dataFolder, ids)
    materializeTransactions(settings.dataFolder)
  })

  ipcMain.handle(IPC_CHANNELS.CLEAR_ALL_DATA, async () => {
    const settings = getSettings()
    clearAllData(settings.dataFolder)
  })

  ipcMain.handle(IPC_CHANNELS.GET_ACCOUNTS, async () => {
    const settings = getSettings()
    return getAccounts(settings.dataFolder)
  })

  // === Receipt Handlers (placeholder) ===

  ipcMain.handle(IPC_CHANNELS.INGEST_RECEIPTS, async (_, req) => {
    const settings = getSettings()
    return ingestReceipts(settings.dataFolder, req)
  })

  ipcMain.handle(IPC_CHANNELS.GET_RECEIPTS, async () => {
    const settings = getSettings()
    if (!settings.dataFolder) return []
    const receipts = readReceiptIndex(settings.dataFolder)
    const txns = queryTransactions(settings.dataFolder, { filters: {}, limit: 99999 })
    const linkedIds = new Set<string>()
    for (const tx of txns.transactions) {
      if (tx.receipt_files) {
        tx.receipt_files.split(';').map((s) => s.trim()).filter(Boolean).forEach((id) => linkedIds.add(id))
      }
    }
    return receipts.map((r) => ({ ...r, linked: linkedIds.has(r.receipt_id) }))
  })

  ipcMain.handle(IPC_CHANNELS.GET_RECEIPT_DETAIL, async (_, _receiptId: string) => {
    const settings = getSettings()
    return readReceiptDetail(settings.dataFolder, _receiptId)
  })

  ipcMain.handle(IPC_CHANNELS.RUN_OCR, async (_, receiptId: string) => {
    const settings = getSettings()
    const receipts = readReceiptIndex(settings.dataFolder)
    const receipt = receipts.find((r) => r.receipt_id === receiptId)
    if (!receipt) throw new Error(`Receipt ${receiptId} not found`)
    const key = settings.anthropicKey || settings.openAiKey
    if (!key) throw new Error('No API key configured. Add an Anthropic or OpenAI key in Settings → API Keys.')
    try {
      const detail = await runReceiptLlmExtract(key, receipt.file_path, receiptId)
      saveReceiptDetailFile(settings.dataFolder, detail)
    } catch (e) {
      updateOcrStatus(settings.dataFolder, receiptId, 'failed')
      throw e
    }
  })

  ipcMain.handle(
    IPC_CHANNELS.GET_RECEIPT_MATCH_PREVIEW,
    async (_, path: string, dayWindow?: number, tolerance?: number) => {
      const settings = getSettings()
      return getReceiptMatchPreview(settings.dataFolder, path, dayWindow, tolerance)
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.GET_RECEIPT_MATCH_PREVIEW_DATA,
    async (_, metadata, dayWindow?: number, tolerance?: number) => {
      const settings = getSettings()
      return getReceiptMatchPreviewFromData(settings.dataFolder, metadata, dayWindow, tolerance)
    }
  )

  ipcMain.handle(IPC_CHANNELS.GET_RECEIPT_PREVIEW, async (_, path: string) => {
    return getReceiptPreviewData(path)
  })

  ipcMain.handle(IPC_CHANNELS.RUN_RECEIPT_LLM, async (_, path: string) => {
    const settings = getSettings()
    return runReceiptLlmExtract(settings.anthropicKey || settings.openAiKey || '', path)
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_RECEIPT_DETAIL, async (_, receiptId: string, detail) => {
    const settings = getSettings()
    saveReceiptDetailFile(settings.dataFolder, { ...detail, receipt_id: receiptId })
  })

  // === Matching Handlers ===

  ipcMain.handle(IPC_CHANNELS.LINK_RECEIPT, async (_, req) => {
    const settings = getSettings()
    const receipts = readReceiptIndex(settings.dataFolder)
    const receipt = receipts.find((r) => r.receipt_id === req.receiptId)
    writeLink(settings.dataFolder, {
      transaction_id: req.transactionId,
      receipt_id: req.receiptId,
      line_item_id: req.lineItemId,
      amount: receipt?.total,
      confidence: 1,
      notes: req.notes ?? 'manual'
    })
    appendChangeRow(settings.dataFolder, {
      transaction_id: req.transactionId,
      change_type: 'link_receipt',
      value: req.receiptId
    })
    await materializeTransactions(settings.dataFolder)
  })

  ipcMain.handle(IPC_CHANNELS.UNLINK_RECEIPT, async (_, txId: string, receiptId: string) => {
    const settings = getSettings()
    removeLink(settings.dataFolder, txId, receiptId)
    appendChangeRow(settings.dataFolder, {
      transaction_id: txId,
      change_type: 'unlink_receipt',
      value: receiptId
    })
    await materializeTransactions(settings.dataFolder)
  })

  ipcMain.handle(IPC_CHANNELS.GET_LINKS, async () => {
    const settings = getSettings()
    if (!settings.dataFolder) return []
    return readLinks(settings.dataFolder)
  })

  ipcMain.handle(IPC_CHANNELS.GET_MATCH_SUGGESTIONS, async (_, _txId: string) => {
    return []
  })

  ipcMain.handle(IPC_CHANNELS.GET_CANDIDATES_FOR_RECEIPT, async (_, receiptId: string) => {
    const settings = getSettings()
    if (!settings.dataFolder) return []
    return getCandidatesForReceipt(settings.dataFolder, receiptId)
  })

  // === Rules Handlers (placeholder) ===

  ipcMain.handle(IPC_CHANNELS.GET_RULES, async () => {
    const settings = getSettings()
    return getRules(settings.dataFolder)
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_RULE, async (_, rule) => {
    const settings = getSettings()
    saveRule(settings.dataFolder, rule)
  })

  ipcMain.handle(IPC_CHANNELS.DELETE_RULE, async (_, ruleId: string) => {
    const settings = getSettings()
    deleteRule(settings.dataFolder, ruleId)
  })

  ipcMain.handle(IPC_CHANNELS.GET_CATEGORIES, async () => {
    const settings = getSettings()
    return { categories: getCategories(settings.dataFolder) }
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_CATEGORIES, async (_, categories) => {
    const settings = getSettings()
    saveCategories(settings.dataFolder, categories)
  })

  // === LLM Q&A Handlers ===

  ipcMain.handle(IPC_CHANNELS.EXPORT_FOR_LLM, async (_, filters, _format: 'csv' | 'md') => {
    const settings = getSettings()
    if (!settings.dataFolder) return ''
    const res = queryTransactions(settings.dataFolder, { filters, limit: 500, offset: 0, sortBy: 'date', sortOrder: 'desc' })
    if (!res.transactions.length) return ''
    return buildTransactionCsv(res.transactions)
  })

  ipcMain.handle(IPC_CHANNELS.ASK_LLM, async (_, req) => {
    const settings = getSettings()
    const { prompt, filters, provider, history = [] } = req

    const res = queryTransactions(settings.dataFolder, { filters, limit: 500, offset: 0, sortBy: 'date', sortOrder: 'desc' })
    const csv = buildTransactionCsv(res.transactions)

    const systemPrompt = `You are a personal finance assistant. Answer the user's question based on their transaction data below. Be concise. Use markdown for tables and bold key numbers.\n\n<transactions total="${res.total}" shown="${res.transactions.length}">\n${csv}\n</transactions>`

    if (provider === 'anthropic') {
      const key = settings.anthropicKey
      if (!key) throw new Error('Anthropic API key not set. Add it in Settings → API Keys.')
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [...history, { role: 'user', content: prompt }]
        })
      })
      if (!r.ok) throw new Error(`Anthropic error ${r.status}: ${await r.text()}`)
      const data = await r.json() as { content: Array<{ type: string; text: string }> }
      return data.content.find(b => b.type === 'text')?.text ?? ''
    } else {
      const key = settings.openAiKey
      if (!key) throw new Error('OpenAI API key not set. Add it in Settings → API Keys.')
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: prompt }]
        })
      })
      if (!r.ok) throw new Error(`OpenAI error ${r.status}: ${await r.text()}`)
      const data = await r.json() as { choices: Array<{ message: { content: string } }> }
      return data.choices[0]?.message?.content ?? ''
    }
  })

  ipcMain.handle(IPC_CHANNELS.CATEGORIZE_TRANSACTIONS, async (_, req) => {
    const settings = getSettings()
    return categorizeTransactionsLlm(settings.openAiKey || '', settings.dataFolder, req)
  })

  ipcMain.handle(IPC_CHANNELS.GET_DASHBOARD_STATS, () => {
    const settings = getSettings()
    if (!settings.dataFolder) return null
    const { transactions } = queryTransactions(settings.dataFolder, { filters: {}, limit: 99999 })

    // Build monthly buckets
    const byMonth: Record<string, { income: number; spending: number; count: number }> = {}
    const byCategory: Record<string, number> = {}
    const currentMonthByCategory: Record<string, number> = {}
    const byMerchant: Record<string, { total: number; count: number; months: Set<string> }> = {}
    const byAccount: Record<string, { income: number; spending: number; count: number }> = {}
    let allTimeIncome = 0
    let allTimeSpending = 0
    let uncategorizedCount = 0
    let uncategorizedSpending = 0
    let transactionsWithReceipts = 0
    let aiEditedCount = 0
    let dateMin: string | null = null
    let dateMax: string | null = null

    for (const tx of transactions) {
      const month = tx.date.slice(0, 7)
      if (!byMonth[month]) byMonth[month] = { income: 0, spending: 0, count: 0 }
      byMonth[month].count += 1
      if (!dateMin || tx.date < dateMin) dateMin = tx.date
      if (!dateMax || tx.date > dateMax) dateMax = tx.date

      if (tx.amount > 0) {
        byMonth[month].income += tx.amount
        allTimeIncome += tx.amount
      } else {
        const spend = Math.abs(tx.amount)
        byMonth[month].spending += spend
        allTimeSpending += spend
      }

      const account = tx.account || 'Unknown'
      if (!byAccount[account]) byAccount[account] = { income: 0, spending: 0, count: 0 }
      byAccount[account].count += 1
      if (tx.amount > 0) byAccount[account].income += tx.amount
      else byAccount[account].spending += Math.abs(tx.amount)

      if (tx.receipt_files?.trim()) transactionsWithReceipts += 1
      if (tx.ai_edited) aiEditedCount += 1

      if (tx.category && tx.amount < 0) {
        byCategory[tx.category] = (byCategory[tx.category] || 0) + Math.abs(tx.amount)
      }
      if (!tx.category && tx.amount < 0) {
        uncategorizedCount += 1
        uncategorizedSpending += Math.abs(tx.amount)
      }

      if (tx.amount < 0) {
        const merchant = (tx.merchant || tx.description || 'Unknown').trim()
        if (!byMerchant[merchant]) byMerchant[merchant] = { total: 0, count: 0, months: new Set<string>() }
        byMerchant[merchant].total += Math.abs(tx.amount)
        byMerchant[merchant].count += 1
        byMerchant[merchant].months.add(month)
      }
    }

    const months = Object.keys(byMonth).sort()
    const currentMonth = months[months.length - 1] ?? ''
    const previousMonth = months.length > 1 ? months[months.length - 2] : null
    const cur = byMonth[currentMonth] ?? { income: 0, spending: 0, count: 0 }
    const prev = previousMonth ? byMonth[previousMonth] : { income: 0, spending: 0, count: 0 }

    if (currentMonth) {
      for (const tx of transactions) {
        if (tx.date.slice(0, 7) !== currentMonth || !tx.category || tx.amount >= 0) continue
        currentMonthByCategory[tx.category] = (currentMonthByCategory[tx.category] || 0) + Math.abs(tx.amount)
      }
    }

    const categoryBreakdown = Object.entries(byCategory)
      .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)

    const topCategory = categoryBreakdown[0]?.category ?? null
    const round = (n: number) => Math.round(n * 100) / 100
    const pctDelta = (current: number, previous: number) => {
      if (previous === 0) return null
      return round(((current - previous) / previous) * 100)
    }
    const daysInCurrentMonth = currentMonth
      ? new Date(Number(currentMonth.slice(0, 4)), Number(currentMonth.slice(5, 7)), 0).getDate()
      : 0

    return {
      currentMonth,
      monthlyIncome: round(cur.income),
      monthlySpending: round(cur.spending),
      monthlyNet: round(cur.income - cur.spending),
      previousMonth,
      previousMonthIncome: round(prev.income),
      previousMonthSpending: round(prev.spending),
      previousMonthNet: round(prev.income - prev.spending),
      monthOverMonthSpendingPct: pctDelta(cur.spending, prev.spending),
      monthOverMonthIncomePct: pctDelta(cur.income, prev.income),
      allTimeIncome: round(allTimeIncome),
      allTimeSpending: round(allTimeSpending),
      allTimeNet: round(allTimeIncome - allTimeSpending),
      transactionCountThisMonth: cur.count,
      averageTransactionAmount: round(transactions.reduce((sum, tx) => sum + tx.amount, 0) / Math.max(transactions.length, 1)),
      averageMonthlySpending: round(allTimeSpending / Math.max(months.length, 1)),
      averageDailySpendingThisMonth: round(cur.spending / Math.max(daysInCurrentMonth, 1)),
      topCategory,
      monthlyTrend: months.map((m) => ({
        month: m,
        income: round(byMonth[m].income),
        spending: round(byMonth[m].spending)
      })),
      categoryBreakdown,
      currentMonthCategoryBreakdown: Object.entries(currentMonthByCategory)
        .map(([category, total]) => ({ category, total: round(total) }))
        .sort((a, b) => b.total - a.total),
      topMerchants: Object.entries(byMerchant)
        .map(([merchant, data]) => ({ merchant, total: round(data.total), count: data.count }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
      accountBreakdown: Object.entries(byAccount)
        .map(([account, data]) => ({
          account,
          income: round(data.income),
          spending: round(data.spending),
          net: round(data.income - data.spending),
          count: data.count
        }))
        .sort((a, b) => b.spending - a.spending),
      largestExpenses: transactions
        .filter((tx) => tx.amount < 0)
        .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
        .slice(0, 8)
        .map((tx) => ({
          id: tx.id,
          date: tx.date,
          merchant: tx.merchant || tx.description || 'Unknown',
          amount: round(Math.abs(tx.amount)),
          category: tx.category
        })),
      recentTransactions: [...transactions]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8)
        .map((tx) => ({
          id: tx.id,
          date: tx.date,
          merchant: tx.merchant || tx.description || 'Unknown',
          amount: round(tx.amount),
          category: tx.category
        })),
      recurringMerchants: Object.entries(byMerchant)
        .map(([merchant, data]) => ({ merchant, total: round(data.total), count: data.count, months: data.months.size }))
        .filter((row) => row.count >= 2 && row.months >= 2)
        .sort((a, b) => b.months - a.months || b.total - a.total)
        .slice(0, 8),
      uncategorizedCount,
      uncategorizedSpending: round(uncategorizedSpending),
      transactionsWithReceipts,
      receiptCoveragePct: round((transactionsWithReceipts / Math.max(transactions.length, 1)) * 100),
      aiEditedCount,
      dateMin,
      dateMax,
      totalTransactions: transactions.length
    }
  })
}
