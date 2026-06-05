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
import {
  importStatementFiles,
  getCsvHeadersForFile,
  getCsvPreviewForFile,
  getCsvMappingForFile,
  getCsvStatsForFile
} from '@core/importer/statement-importer'
import { materializeTransactions, queryTransactions, queryLineItems } from '@core/materializer'
import { deleteTransactionsById, clearAllData } from '@core/data-admin'
import { getAccounts } from '@core/accounts'
import { appendChangeRow } from '@core/ledger/changes'
import {
  ingestReceipts,
  readReceiptIndex,
  getReceiptMatchPreview,
  getReceiptMatchPreviewFromData,
  getReceiptPreviewData
} from '@core/receipts/importer'
import {
  runReceiptLlmExtract,
  saveReceiptDetail as saveReceiptDetailFile,
  readReceiptDetail
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
    // TODO: Implement in Phase 2
    return []
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

  ipcMain.handle(IPC_CHANNELS.RUN_OCR, async (_, _receiptId: string) => {
    // TODO: Implement in Phase 5
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
    return runReceiptLlmExtract(settings.openAiKey || '', path)
  })

  ipcMain.handle(IPC_CHANNELS.SAVE_RECEIPT_DETAIL, async (_, receiptId: string, detail) => {
    const settings = getSettings()
    saveReceiptDetailFile(settings.dataFolder, { ...detail, receipt_id: receiptId })
  })

  // === Matching Handlers (placeholder) ===

  ipcMain.handle(IPC_CHANNELS.LINK_RECEIPT, async (_, _req) => {
    // TODO: Implement in Phase 6
  })

  ipcMain.handle(IPC_CHANNELS.UNLINK_RECEIPT, async (_, _txId: string, _receiptId: string) => {
    // TODO: Implement in Phase 6
  })

  ipcMain.handle(IPC_CHANNELS.GET_LINKS, async () => {
    // TODO: Implement in Phase 6
    return []
  })

  ipcMain.handle(IPC_CHANNELS.GET_MATCH_SUGGESTIONS, async (_, _txId: string) => {
    // TODO: Implement in Phase 6
    return []
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

  // === LLM Handlers (placeholder) ===

  ipcMain.handle(IPC_CHANNELS.EXPORT_FOR_LLM, async (_, _filters, _format: 'csv' | 'md') => {
    // TODO: Implement in Phase 8
    return ''
  })

  ipcMain.handle(IPC_CHANNELS.ASK_LLM, async (_, _req) => {
    // TODO: Implement in Phase 8
    return ''
  })

  ipcMain.handle(IPC_CHANNELS.CATEGORIZE_TRANSACTIONS, async (_, req) => {
    const settings = getSettings()
    return categorizeTransactionsLlm(settings.openAiKey || '', settings.dataFolder, req)
  })
}
