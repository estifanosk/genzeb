// === Core Domain Types ===

export interface LedgerRow {
  id: string
  account: string
  date: string // YYYY-MM-DD
  post_date?: string
  description_raw: string
  merchant_raw: string
  amount: number // signed decimal
  currency: string // ISO code
  source_file: string
  source_hash: string
  import_time: string // ISO timestamp
}

export type ChangeType =
  | 'set_category'
  | 'set_merchant'
  | 'set_notes'
  | 'set_subcategory'
  | 'split'
  | 'link_receipt'
  | 'unlink_receipt'

export interface ChangeRow {
  change_id: string
  transaction_id: string
  change_type: ChangeType
  field?: string
  value: string // text or JSON
  time: string // ISO timestamp
  agent?: string  // set when the change was made by an AI agent (e.g. 'claude')
}

export interface TransactionRow {
  id: string
  parent_id?: string
  account: string
  date: string
  post_date?: string
  description: string
  merchant: string
  amount: number
  currency: string
  category?: string
  subcategory?: string
  notes?: string
  receipt_files?: string // semicolon-separated
  line_items?: string // JSON
  source_file: string
  source_hash: string
  import_time: string
  confidence?: number
  ai_edited?: boolean  // true when any change on this transaction was made by an AI agent
}

export interface ImportLogRow {
  import_id: string
  source_file: string
  source_hash: string
  file_type: 'csv' | 'pdf' | 'image' | 'html'
  imported_at: string
  rows_imported: number
  rows_skipped: number
  notes?: string
}

export interface ReceiptIndexRow {
  receipt_id: string
  file_path: string
  receipt_type: 'image' | 'pdf' | 'html' | 'email'
  merchant?: string
  date?: string
  total?: number
  currency?: string
  source_hash: string
  ocr_status: 'pending' | 'ok' | 'failed'
  created_at: string
}

export interface ReceiptDetail {
  receipt_id: string
  file_path: string
  merchant?: string
  date?: string
  total?: number
  currency?: string
  tax?: number
  tip?: number
  confidence?: number
  line_items: LineItem[]
  raw_text?: string
}

export interface LineItem {
  line_item_id: string
  description: string
  quantity?: number
  unit_price?: number
  total: number
  category_hint?: string
  confidence?: number
}

export interface LineItemExplorerRow {
  id: string
  transaction_id: string
  receipt_id: string
  date: string
  merchant: string
  description: string
  item: string
  quantity?: number
  unit_price?: number
  item_total: number
  transaction_amount: number
  account: string
  category?: string
  subcategory?: string
  notes?: string
  item_category?: string
  is_unlinked?: boolean
}

export interface LinkRow {
  link_id: string
  transaction_id: string
  receipt_id: string
  line_item_id?: string
  amount?: number
  confidence?: number
  notes?: string
}

export interface CategoryRule {
  rule_id: string
  match_type: 'merchant_contains' | 'description_contains' | 'merchant_or_description_contains' | 'merchant_regex'
  match_value: string
  category: string
  subcategory?: string
  priority: number
  enabled: boolean
}

export interface CategoryItem {
  category: string
  subcategory?: string
}

// === Import Types ===

export interface ImportResult {
  import_id: string
  source_file: string
  rows_imported: number
  rows_skipped: number
  errors: ImportError[]
  duplicates: string[]
}

export interface ImportError {
  row: number
  message: string
  data?: Record<string, unknown>
}

export interface ColumnMapping {
  date: string
  amount: string
  description?: string
  merchant?: string
  post_date?: string
}

// === Filter Types ===

export interface TransactionFilters {
  search?: string
  dateRange?: { start: string; end: string }
  amountRange?: { min: number; max: number }
  categories?: string[]
  accounts?: string[]
  hasReceipt?: boolean
  uncategorized?: boolean
  merchantContains?: string
}

export interface ExportFilters extends TransactionFilters {
  limit?: number
}

// === App Settings ===

export interface AppSettings {
  dataFolder: string
  openAiKey?: string
  anthropicKey?: string
  defaultAccount?: string
  autoMaterialize: boolean
}

// === Account Metadata ===

export interface AccountInfo {
  accountNumber: string
  accountType?: string
  bankName?: string
  period?: string
  sourceFiles: string[]
  lastImportedAt?: string
}

// === Split Payload ===

export interface SplitPayload {
  id: string
  amount: number
  category?: string
  subcategory?: string
  notes?: string
  receipt_id?: string
  line_item_id?: string
}
