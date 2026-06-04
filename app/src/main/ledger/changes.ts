import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'
import type { ChangeRow } from '../../shared/types'
import { ensureDataStructure, getDataFilePath } from '../utils/paths'

const CHANGE_HEADERS = ['change_id', 'transaction_id', 'change_type', 'field', 'value', 'time']

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function appendCsvRow(filePath: string, headers: string[], row: Record<string, unknown>): void {
  const needsHeader = !existsSync(filePath)
  if (needsHeader) {
    writeFileSync(filePath, `${headers.join(',')}\n`, 'utf-8')
  }
  const values = headers.map((header) => {
    const raw = row[header]
    return escapeCsvValue(raw === undefined || raw === null ? '' : String(raw))
  })
  appendFileSync(filePath, `${values.join(',')}\n`, 'utf-8')
}

export function appendChangeRow(
  dataFolder: string,
  change: Omit<ChangeRow, 'change_id' | 'time'>
): ChangeRow {
  if (!dataFolder) throw new Error('Data folder is not configured')
  ensureDataStructure(dataFolder)
  const changesPath = getDataFilePath(dataFolder, 'CHANGES')
  const row: ChangeRow = {
    change_id: uuidv4(),
    time: new Date().toISOString(),
    ...change
  }
  appendCsvRow(changesPath, CHANGE_HEADERS, row as unknown as Record<string, unknown>)
  return row
}

export function readChanges(dataFolder: string): ChangeRow[] {
  if (!dataFolder) throw new Error('Data folder is not configured')
  const changesPath = getDataFilePath(dataFolder, 'CHANGES')
  if (!existsSync(changesPath)) return []
  const content = readFileSync(changesPath, 'utf-8')
  if (!content.trim()) return []
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  return parsed.data
    .filter((row) => row && row.change_id)
    .map((row) => ({
      change_id: row.change_id,
      transaction_id: row.transaction_id,
      change_type: row.change_type as ChangeRow['change_type'],
      field: row.field || undefined,
      value: row.value ?? '',
      time: row.time
    }))
}
