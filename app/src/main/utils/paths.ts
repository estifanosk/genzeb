import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'

// Default data folder location
export function getDefaultDataFolder(): string {
  return join(app.getPath('documents'), 'LedgerBox')
}

// Data folder structure
export const DATA_STRUCTURE = {
  INBOX: 'Inbox',
  INBOX_STATEMENTS: 'Inbox/statements',
  INBOX_STATEMENTS_IMPORTED: 'Inbox/statements/imported',
  INBOX_RECEIPTS: 'Inbox/receipts',
  INBOX_RECEIPTS_IMPORTED: 'Inbox/receipts/imported',
  DATA: 'Data',
  TRANSACTIONS: 'Data/transactions',
  RECEIPTS: 'Data/receipts',
  MATCHES: 'Data/matches',
  RULES: 'Data/rules',
  INDEX: 'Data/index',
  EXPORTS: 'Exports',
  LLM_EXPORTS: 'Exports/llm'
} as const

// File paths within data folder
export const DATA_FILES = {
  LEDGER: 'Data/transactions/ledger.csv',
  CHANGES: 'Data/transactions/changes.csv',
  TRANSACTIONS: 'Data/transactions/transactions.csv',
  IMPORT_LOG: 'Data/transactions/import-log.csv',
  ACCOUNTS: 'Data/accounts.json',
  RECEIPTS_INDEX: 'Data/receipts/index.csv',
  LINKS: 'Data/matches/links.csv',
  CATEGORIES: 'Data/rules/categories.csv',
  CATEGORY_RULES: 'Data/rules/category-rules.csv',
  SQLITE_INDEX: 'Data/index/ledger.sqlite'
} as const

// Ensure all required directories exist
export function ensureDataStructure(dataFolder: string): void {
  const directories = Object.values(DATA_STRUCTURE)

  for (const dir of directories) {
    const fullPath = join(dataFolder, dir)
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true })
    }
  }
}

// Get full path to a data file
export function getDataFilePath(dataFolder: string, file: keyof typeof DATA_FILES): string {
  return join(dataFolder, DATA_FILES[file])
}

// Get full path to a directory
export function getDataDirPath(dataFolder: string, dir: keyof typeof DATA_STRUCTURE): string {
  return join(dataFolder, DATA_STRUCTURE[dir])
}

// Settings file location (in app data, not user data folder)
export function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}
