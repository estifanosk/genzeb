import { existsSync, readFileSync, writeFileSync } from 'fs'
import { ensureDataStructure, getDataFilePath } from '../storage/paths'
import type { AccountInfo } from '../types'

function readAccountsFile(path: string): AccountInfo[] {
  if (!existsSync(path)) return []
  const content = readFileSync(path, 'utf-8')
  if (!content.trim()) return []
  try {
    return JSON.parse(content) as AccountInfo[]
  } catch {
    return []
  }
}

function writeAccountsFile(path: string, accounts: AccountInfo[]): void {
  writeFileSync(path, JSON.stringify(accounts, null, 2), 'utf-8')
}

export function getAccounts(dataFolder: string): AccountInfo[] {
  if (!dataFolder) throw new Error('Data folder is not configured')
  ensureDataStructure(dataFolder)
  const path = getDataFilePath(dataFolder, 'ACCOUNTS')
  return readAccountsFile(path)
}

export function upsertAccount(dataFolder: string, info: AccountInfo): void {
  if (!dataFolder) throw new Error('Data folder is not configured')
  ensureDataStructure(dataFolder)
  const path = getDataFilePath(dataFolder, 'ACCOUNTS')
  const accounts = readAccountsFile(path)

  const existing = accounts.find((acct) => acct.accountNumber === info.accountNumber)
  if (existing) {
    existing.accountType = info.accountType ?? existing.accountType
    existing.bankName = info.bankName ?? existing.bankName
    existing.period = info.period ?? existing.period
    existing.lastImportedAt = info.lastImportedAt ?? existing.lastImportedAt
    const merged = new Set([...(existing.sourceFiles ?? []), ...(info.sourceFiles ?? [])])
    existing.sourceFiles = Array.from(merged)
  } else {
    accounts.push(info)
  }

  writeAccountsFile(path, accounts)
}
