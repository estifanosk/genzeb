import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type LedgerBoxAPI } from '@core/types/ipc'
import type {
  AppSettings,
  ChangeRow,
  CategoryRule,
  CategoryItem,
  ExportFilters
} from '@core/types'
import type {
  ImportStatementsRequest,
  QueryTransactionsRequest,
  QueryLineItemsRequest,
  CategorizeTransactionsRequest,
  LinkReceiptRequest,
  AskLlmRequest,
  IngestReceiptsRequest
} from '@core/types/ipc'

// Create the API object
const api: LedgerBoxAPI = {
  // File System
  selectDataFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_DATA_FOLDER),
  scanInbox: () => ipcRenderer.invoke(IPC_CHANNELS.SCAN_INBOX),
  ensureDataStructure: () => ipcRenderer.invoke(IPC_CHANNELS.ENSURE_DATA_STRUCTURE),
  openFolder: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_FOLDER, path),
  getInboxPaths: () => ipcRenderer.invoke(IPC_CHANNELS.GET_INBOX_PATHS),

  // Import
  importStatements: (req: ImportStatementsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.IMPORT_STATEMENTS, req),
  getCsvHeaders: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_CSV_HEADERS, path),
  getCsvPreview: (path: string, rows?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_CSV_PREVIEW, path, rows),
  getCsvMapping: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_CSV_MAPPING, path),
  getCsvStats: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_CSV_STATS, path),

  // Ledger
  appendChange: (change: Omit<ChangeRow, 'change_id' | 'time'>) =>
    ipcRenderer.invoke(IPC_CHANNELS.APPEND_CHANGE, change),

  // Materializer
  materialize: () => ipcRenderer.invoke(IPC_CHANNELS.MATERIALIZE),
  getTransactions: (req: QueryTransactionsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUERY_TRANSACTIONS, req),
  getLineItems: (req: QueryLineItemsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.QUERY_LINE_ITEMS, req),
  deleteTransactions: (ids: string[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.DELETE_TRANSACTIONS, ids),
  clearAllData: () => ipcRenderer.invoke(IPC_CHANNELS.CLEAR_ALL_DATA),

  // Receipts
  ingestReceipts: (req: IngestReceiptsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.INGEST_RECEIPTS, req),
  getReceipts: () => ipcRenderer.invoke(IPC_CHANNELS.GET_RECEIPTS),
  getReceiptDetail: (receiptId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_RECEIPT_DETAIL, receiptId),
  runOcr: (receiptId: string) => ipcRenderer.invoke(IPC_CHANNELS.RUN_OCR, receiptId),
  getReceiptMatchPreview: (path: string, dayWindow?: number, tolerance?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_RECEIPT_MATCH_PREVIEW, path, dayWindow, tolerance),
  getReceiptPreview: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.GET_RECEIPT_PREVIEW, path),
  runReceiptLlm: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.RUN_RECEIPT_LLM, path),
  saveReceiptDetail: (receiptId: string, detail) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_RECEIPT_DETAIL, receiptId, detail),
  getReceiptMatchPreviewData: (metadata, dayWindow?: number, tolerance?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_RECEIPT_MATCH_PREVIEW_DATA, metadata, dayWindow, tolerance),

  // Matching
  linkReceipt: (req: LinkReceiptRequest) => ipcRenderer.invoke(IPC_CHANNELS.LINK_RECEIPT, req),
  unlinkReceipt: (transactionId: string, receiptId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.UNLINK_RECEIPT, transactionId, receiptId),
  getMatchSuggestions: (transactionId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_MATCH_SUGGESTIONS, transactionId),

  // Rules
  getRules: () => ipcRenderer.invoke(IPC_CHANNELS.GET_RULES),
  saveRule: (rule: CategoryRule) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_RULE, rule),
  deleteRule: (ruleId: string) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_RULE, ruleId),
  getCategories: () => ipcRenderer.invoke(IPC_CHANNELS.GET_CATEGORIES),
  saveCategories: (categories: CategoryItem[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_CATEGORIES, categories),

  // Settings
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.GET_SETTINGS),
  saveSettings: (settings: Partial<AppSettings>) =>
    ipcRenderer.invoke(IPC_CHANNELS.SAVE_SETTINGS, settings),

  // Accounts
  getAccounts: () => ipcRenderer.invoke(IPC_CHANNELS.GET_ACCOUNTS),

  // LLM
  exportForLlm: (filters: ExportFilters, format: 'csv' | 'md') =>
    ipcRenderer.invoke(IPC_CHANNELS.EXPORT_FOR_LLM, filters, format),
  askLlm: (req: AskLlmRequest) => ipcRenderer.invoke(IPC_CHANNELS.ASK_LLM, req),
  categorizeTransactions: (req: CategorizeTransactionsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.CATEGORIZE_TRANSACTIONS, req)
}

// Use `contextBridge` APIs to expose Electron APIs to renderer
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Failed to expose API:', error)
  }
} else {
  // @ts-ignore - fallback for non-isolated context
  window.api = api
}
