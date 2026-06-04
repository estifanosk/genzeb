import type {
  ChangeRow,
  TransactionRow,
  ImportResult,
  ReceiptIndexRow,
  ReceiptDetail,
  CategoryRule,
  CategoryItem,
  TransactionFilters,
  ExportFilters,
  ColumnMapping,
  AppSettings,
  AccountInfo,
  LineItemExplorerRow
} from './index'

// === IPC Channel Names ===
export const IPC_CHANNELS = {
  // File System
  SELECT_DATA_FOLDER: 'fs:select-data-folder',
  SCAN_INBOX: 'fs:scan-inbox',
  ENSURE_DATA_STRUCTURE: 'fs:ensure-data-structure',
  OPEN_FOLDER: 'fs:open-folder',
  GET_INBOX_PATHS: 'fs:get-inbox-paths',

  // Import
  IMPORT_STATEMENTS: 'import:statements',
  GET_CSV_HEADERS: 'import:get-csv-headers',
  GET_CSV_PREVIEW: 'import:get-csv-preview',
  GET_CSV_MAPPING: 'import:get-csv-mapping',
  GET_CSV_STATS: 'import:get-csv-stats',
  GET_RECEIPT_MATCH_PREVIEW: 'receipts:match-preview',
  GET_RECEIPT_MATCH_PREVIEW_DATA: 'receipts:match-preview-data',
  GET_RECEIPT_PREVIEW: 'receipts:preview',
  RUN_RECEIPT_LLM: 'receipts:llm-extract',
  SAVE_RECEIPT_DETAIL: 'receipts:save-detail',
  SAVE_COLUMN_MAPPING: 'import:save-column-mapping',

  // Ledger
  APPEND_CHANGE: 'ledger:append-change',
  GET_CHANGES: 'ledger:get-changes',

  // Materializer
  MATERIALIZE: 'materializer:run',
  GET_TRANSACTIONS: 'materializer:get-transactions',
  QUERY_TRANSACTIONS: 'materializer:query',
  QUERY_LINE_ITEMS: 'materializer:query-line-items',
  DELETE_TRANSACTIONS: 'transactions:delete',
  CLEAR_ALL_DATA: 'data:clear-all',

  // Receipts
  INGEST_RECEIPTS: 'receipts:ingest',
  GET_RECEIPTS: 'receipts:get-all',
  GET_RECEIPT_DETAIL: 'receipts:get-detail',
  RUN_OCR: 'receipts:run-ocr',

  // Matching
  LINK_RECEIPT: 'matching:link',
  UNLINK_RECEIPT: 'matching:unlink',
  GET_LINKS: 'matching:get-links',
  GET_MATCH_SUGGESTIONS: 'matching:suggestions',

  // Rules
  GET_RULES: 'rules:get-all',
  SAVE_RULE: 'rules:save',
  DELETE_RULE: 'rules:delete',
  GET_CATEGORIES: 'rules:get-categories',
  SAVE_CATEGORIES: 'rules:save-categories',

  // Settings
  GET_SETTINGS: 'settings:get',
  SAVE_SETTINGS: 'settings:save',
  GET_ACCOUNTS: 'accounts:get-all',

  // LLM
  EXPORT_FOR_LLM: 'llm:export',
  ASK_LLM: 'llm:ask',
  CATEGORIZE_TRANSACTIONS: 'llm:categorize-transactions'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

// === IPC Request/Response Types ===

export interface ImportStatementsRequest {
  paths: string[]
  columnMapping?: ColumnMapping
  account: string
}

export interface QueryTransactionsRequest {
  filters: TransactionFilters
  sortBy?: Extract<keyof TransactionRow, string>
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface QueryTransactionsResponse {
  transactions: TransactionRow[]
  total: number
}

export interface QueryLineItemsRequest {
  filters?: {
    search?: string
    category?: string
    merchant?: string
    dateRange?: {
      start?: string
      end?: string
    }
    amountRange?: {
      min?: number
      max?: number
    }
  }
  sortBy?: 'date' | 'merchant' | 'item' | 'total' | 'category'
  sortOrder?: 'asc' | 'desc'
}

export interface QueryLineItemsResponse {
  items: LineItemExplorerRow[]
  total: number
  totalAmount: number
}

export interface CategorizeTransactionsRequest {
  transactions: Array<{
    id: string
    merchant: string
    description: string
    amount: number
    date: string
  }>
}

export interface CategorizeTransactionsResponse {
  suggestions: Array<{
    transaction_id: string
    category: string | null
    subcategory?: string | null
    confidence: number
    rationale?: string
  }>
}

export interface LinkReceiptRequest {
  transactionId: string
  receiptId: string
  lineItemId?: string
  notes?: string
}

export interface AskLlmRequest {
  prompt: string
  filters: ExportFilters
  provider: 'openai' | 'anthropic'
}

export interface MatchSuggestion {
  receipt: ReceiptIndexRow
  score: number
  breakdown: {
    amount: number
    date: number
    merchant: number
  }
}

export interface InboxScanResult {
  statements: string[]
  receipts: string[]
}

export interface InboxPaths {
  statements: string
  receipts: string
}

export interface CsvPreview {
  headers: string[]
  rows: Record<string, string>[]
}

export interface CsvMappingInfo {
  mapping: {
    date?: string
    post_date?: string
    amount?: string
    description?: string
    merchant?: string
    debit?: string
    credit?: string
  }
  ignoredHeaders: string[]
}

export interface CsvStats {
  rowCount: number
  dateMin?: string
  dateMax?: string
}

export interface ReceiptMatchPreview {
  hasTransactions: boolean
  metadata: {
    date?: string
    amount?: number
    merchant?: string
  }
  matches: Array<{
    transactionId: string
    date: string
    amount: number
    merchant: string
    score: number
  }>
}

export interface ReceiptMatchMetadata {
  date?: string
  amount?: number
  merchant?: string
}

export interface IngestReceiptsRequest {
  paths: string[]
  mode: 'link' | 'unmatched'
  tolerance?: number
  dayWindow?: number
  matchTransactionId?: string
  matchMetadata?: ReceiptMatchMetadata
}

export interface IngestReceiptsResponse {
  receipts: ReceiptIndexRow[]
  linked: number
  unmatched: number
}

// === Preload API Shape ===
export interface LedgerBoxAPI {
  // File System
  selectDataFolder(): Promise<string | null>
  scanInbox(): Promise<InboxScanResult>
  ensureDataStructure(): Promise<void>
  openFolder(path: string): Promise<void>
  getInboxPaths(): Promise<InboxPaths>

  // Import
  importStatements(req: ImportStatementsRequest): Promise<ImportResult[]>
  getCsvHeaders(path: string): Promise<string[]>
  getCsvPreview(path: string, rows?: number): Promise<CsvPreview>
  getCsvMapping(path: string): Promise<CsvMappingInfo>
  getCsvStats(path: string): Promise<CsvStats>

  // Ledger
  appendChange(change: Omit<ChangeRow, 'change_id' | 'time'>): Promise<void>

  // Materializer
  materialize(): Promise<void>
  getTransactions(req: QueryTransactionsRequest): Promise<QueryTransactionsResponse>
  getLineItems(req: QueryLineItemsRequest): Promise<QueryLineItemsResponse>
  deleteTransactions(ids: string[]): Promise<void>
  clearAllData(): Promise<void>

  // Receipts
  ingestReceipts(req: IngestReceiptsRequest): Promise<IngestReceiptsResponse>
  getReceipts(): Promise<ReceiptIndexRow[]>
  getReceiptDetail(receiptId: string): Promise<ReceiptDetail | null>
  runOcr(receiptId: string): Promise<void>
  getReceiptMatchPreview(path: string, dayWindow?: number, tolerance?: number): Promise<ReceiptMatchPreview>
  getReceiptPreview(path: string): Promise<string | null>
  runReceiptLlm(path: string): Promise<ReceiptDetail>
  saveReceiptDetail(receiptId: string, detail: ReceiptDetail): Promise<void>
  getReceiptMatchPreviewData(
    metadata: ReceiptMatchMetadata,
    dayWindow?: number,
    tolerance?: number
  ): Promise<ReceiptMatchPreview>

  // Matching
  linkReceipt(req: LinkReceiptRequest): Promise<void>
  unlinkReceipt(transactionId: string, receiptId: string): Promise<void>
  getMatchSuggestions(transactionId: string): Promise<MatchSuggestion[]>

  // Rules
  getRules(): Promise<CategoryRule[]>
  saveRule(rule: CategoryRule): Promise<void>
  deleteRule(ruleId: string): Promise<void>
  getCategories(): Promise<{ categories: CategoryItem[] }>
  saveCategories(categories: CategoryItem[]): Promise<void>

  // Settings
  getSettings(): Promise<AppSettings>
  saveSettings(settings: Partial<AppSettings>): Promise<void>

  // Accounts
  getAccounts(): Promise<AccountInfo[]>

  // LLM
  exportForLlm(filters: ExportFilters, format: 'csv' | 'md'): Promise<string>
  askLlm(req: AskLlmRequest): Promise<string>
  categorizeTransactions(req: CategorizeTransactionsRequest): Promise<CategorizeTransactionsResponse>
}

// Extend Window interface
declare global {
  interface Window {
    api: LedgerBoxAPI
  }
}
