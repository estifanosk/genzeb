import { existsSync, mkdirSync, renameSync } from 'fs'
import { basename, join } from 'path'
import { getDataDirPath } from './paths'

export function moveToImported(
  dataFolder: string,
  filePath: string,
  type: 'statement' | 'receipt'
): string {
  const importedDir =
    type === 'statement'
      ? getDataDirPath(dataFolder, 'INBOX_STATEMENTS_IMPORTED')
      : getDataDirPath(dataFolder, 'INBOX_RECEIPTS_IMPORTED')

  if (!existsSync(importedDir)) {
    mkdirSync(importedDir, { recursive: true })
  }

  const fileName = basename(filePath)
  let destPath = join(importedDir, fileName)

  if (existsSync(destPath)) {
    const timestamp = Date.now()
    const ext = fileName.includes('.') ? `.${fileName.split('.').pop()}` : ''
    const nameWithoutExt = ext ? fileName.slice(0, -ext.length) : fileName
    destPath = join(importedDir, `${nameWithoutExt}_${timestamp}${ext}`)
  }

  renameSync(filePath, destPath)
  return destPath
}

export function moveFilesToImported(
  dataFolder: string,
  filePaths: string[],
  type: 'statement' | 'receipt'
): string[] {
  return filePaths.map((filePath) => moveToImported(dataFolder, filePath, type))
}
