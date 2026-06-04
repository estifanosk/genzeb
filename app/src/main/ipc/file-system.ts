import { dialog, shell } from 'electron'
import { readdirSync, statSync, renameSync, existsSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { ensureDataStructure, getDataDirPath } from '../utils/paths'
import type { AppSettings } from '../../shared/types'

// Open folder picker dialog
export async function selectDataFolder(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Select Data Folder',
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Select Folder'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
}

// Scan a folder for files with specific extensions
function scanFolder(folderPath: string, extensions: string[]): string[] {
  const files: string[] = []

  try {
    const entries = readdirSync(folderPath)

    for (const entry of entries) {
      const fullPath = join(folderPath, entry)
      const stat = statSync(fullPath)

      if (stat.isFile()) {
        const ext = entry.toLowerCase().split('.').pop()
        if (extensions.includes(ext || '')) {
          files.push(fullPath)
        }
      }
    }
  } catch {
    // Folder might not exist yet, that's ok
  }

  return files
}

// Scan inbox/statements folder for statement files (CSV, PDF)
export function scanInboxStatements(dataFolder: string): string[] {
  const statementsPath = getDataDirPath(dataFolder, 'INBOX_STATEMENTS')
  return scanFolder(statementsPath, ['csv', 'pdf'])
}

// Scan inbox/receipts folder for receipt files (images, PDFs, HTML)
export function scanInboxReceipts(dataFolder: string): string[] {
  const receiptsPath = getDataDirPath(dataFolder, 'INBOX_RECEIPTS')
  return scanFolder(receiptsPath, ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'heic', 'html'])
}

// Scan both inbox folders and return combined result
export interface InboxScanResult {
  statements: string[]
  receipts: string[]
}

export function scanInbox(dataFolder: string): InboxScanResult {
  return {
    statements: scanInboxStatements(dataFolder),
    receipts: scanInboxReceipts(dataFolder)
  }
}

// Ensure data folder structure exists
export function ensureDataFolderStructure(dataFolder: string): void {
  ensureDataStructure(dataFolder)
}

// Move a file to the imported folder after successful processing
export function moveToImported(
  dataFolder: string,
  filePath: string,
  type: 'statement' | 'receipt'
): string {
  const importedDir =
    type === 'statement'
      ? getDataDirPath(dataFolder, 'INBOX_STATEMENTS_IMPORTED')
      : getDataDirPath(dataFolder, 'INBOX_RECEIPTS_IMPORTED')

  // Ensure imported directory exists
  if (!existsSync(importedDir)) {
    mkdirSync(importedDir, { recursive: true })
  }

  const fileName = basename(filePath)
  let destPath = join(importedDir, fileName)

  // Handle filename collisions by adding timestamp
  if (existsSync(destPath)) {
    const timestamp = Date.now()
    const ext = fileName.includes('.') ? '.' + fileName.split('.').pop() : ''
    const nameWithoutExt = ext ? fileName.slice(0, -ext.length) : fileName
    destPath = join(importedDir, `${nameWithoutExt}_${timestamp}${ext}`)
  }

  renameSync(filePath, destPath)
  return destPath
}

// Move multiple files to imported folder
export function moveFilesToImported(
  dataFolder: string,
  filePaths: string[],
  type: 'statement' | 'receipt'
): string[] {
  return filePaths.map((filePath) => moveToImported(dataFolder, filePath, type))
}

// Open a folder in the system file manager (Finder/Explorer)
export async function openInFileManager(folderPath: string): Promise<void> {
  // Ensure folder exists before opening
  if (!existsSync(folderPath)) {
    mkdirSync(folderPath, { recursive: true })
  }
  await shell.openPath(folderPath)
}

// Get inbox folder paths
export function getInboxPaths(dataFolder: string): { statements: string; receipts: string } {
  return {
    statements: getDataDirPath(dataFolder, 'INBOX_STATEMENTS'),
    receipts: getDataDirPath(dataFolder, 'INBOX_RECEIPTS')
  }
}

// Get a setting value (used internally by settings module)
let cachedSettings: AppSettings | null = null

export function getCachedSettings(): AppSettings | null {
  return cachedSettings
}

export function setCachedSettings(settings: AppSettings): void {
  cachedSettings = settings
}
