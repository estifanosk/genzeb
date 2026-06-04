import { existsSync, readFileSync, writeFileSync } from 'fs'
import Papa from 'papaparse'
import { v4 as uuidv4 } from 'uuid'
import type { CategoryItem, CategoryRule } from '../types'
import { ensureDataStructure, getDataFilePath } from '../storage/paths'

const DEFAULT_CATEGORIES: CategoryItem[] = [
  { category: 'Groceries', subcategory: 'Produce' },
  { category: 'Groceries', subcategory: 'Meat & Seafood' },
  { category: 'Groceries', subcategory: 'Dairy' },
  { category: 'Groceries', subcategory: 'Snacks' },
  { category: 'Dining', subcategory: 'Restaurants' },
  { category: 'Dining', subcategory: 'Coffee' },
  { category: 'Transport', subcategory: 'Gas' },
  { category: 'Transport', subcategory: 'Rideshare' },
  { category: 'Shopping', subcategory: 'Household' },
  { category: 'Shopping', subcategory: 'Clothing' },
  { category: 'Health', subcategory: 'Pharmacy' },
  { category: 'Health', subcategory: 'Medical' },
  { category: 'Utilities', subcategory: 'Electric' },
  { category: 'Utilities', subcategory: 'Internet' },
  { category: 'Entertainment', subcategory: 'Streaming' }
]

function writeCsv(
  filePath: string,
  headers: string[],
  rows: object[]
) {
  const lines = [headers.join(',')]
  for (const row of rows) {
    const values = headers.map((key) => {
      const raw = (row as Record<string, unknown>)[key]
      const value = raw === undefined || raw === null ? '' : String(raw)
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    })
    lines.push(values.join(','))
  }
  writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf-8')
}

export function ensureDefaultCategories(dataFolder: string): void {
  if (!dataFolder) return
  ensureDataStructure(dataFolder)
  const filePath = getDataFilePath(dataFolder, 'CATEGORIES')
  if (existsSync(filePath)) return
  writeCsv(filePath, ['category', 'subcategory'], DEFAULT_CATEGORIES)
}

export function getCategories(dataFolder: string): CategoryItem[] {
  ensureDefaultCategories(dataFolder)
  const filePath = getDataFilePath(dataFolder, 'CATEGORIES')
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf-8')
  if (!content.trim()) return []
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  return parsed.data
    .filter((row) => row.category)
    .map((row) => ({ category: row.category, subcategory: row.subcategory || undefined }))
}

export function saveCategories(dataFolder: string, categories: CategoryItem[]): void {
  ensureDataStructure(dataFolder)
  const filePath = getDataFilePath(dataFolder, 'CATEGORIES')
  writeCsv(filePath, ['category', 'subcategory'], categories)
}

export function getRules(dataFolder: string): CategoryRule[] {
  ensureDataStructure(dataFolder)
  const filePath = getDataFilePath(dataFolder, 'CATEGORY_RULES')
  if (!existsSync(filePath)) return []
  const content = readFileSync(filePath, 'utf-8')
  if (!content.trim()) return []
  const parsed = Papa.parse<Record<string, string>>(content, { header: true, skipEmptyLines: true })
  return parsed.data
    .filter((row) => row.rule_id)
    .map((row) => ({
      rule_id: row.rule_id,
      match_type: (row.match_type as CategoryRule['match_type']) || 'merchant_or_description_contains',
      match_value: row.match_value || '',
      category: row.category || '',
      subcategory: row.subcategory || undefined,
      priority: row.priority ? Number(row.priority) : 100,
      enabled: row.enabled !== 'false'
    }))
}

export function saveRule(dataFolder: string, rule: CategoryRule): void {
  ensureDataStructure(dataFolder)
  const filePath = getDataFilePath(dataFolder, 'CATEGORY_RULES')
  const existing = getRules(dataFolder)
  const id = rule.rule_id || uuidv4()
  const normalized: CategoryRule = {
    ...rule,
    rule_id: id,
    match_type: rule.match_type || 'merchant_or_description_contains',
    priority: rule.priority ?? 100,
    enabled: rule.enabled ?? true
  }
  const updated = existing.filter((r) => r.rule_id !== id)
  updated.push(normalized)
  writeCsv(
    filePath,
    ['rule_id', 'match_type', 'match_value', 'category', 'subcategory', 'priority', 'enabled'],
    updated.map((r) => ({
      rule_id: r.rule_id,
      match_type: r.match_type,
      match_value: r.match_value,
      category: r.category,
      subcategory: r.subcategory,
      priority: r.priority,
      enabled: r.enabled
    }))
  )
}

export function deleteRule(dataFolder: string, ruleId: string): void {
  ensureDataStructure(dataFolder)
  const filePath = getDataFilePath(dataFolder, 'CATEGORY_RULES')
  const existing = getRules(dataFolder)
  const updated = existing.filter((r) => r.rule_id !== ruleId)
  writeCsv(
    filePath,
    ['rule_id', 'match_type', 'match_value', 'category', 'subcategory', 'priority', 'enabled'],
    updated.map((r) => ({
      rule_id: r.rule_id,
      match_type: r.match_type,
      match_value: r.match_value,
      category: r.category,
      subcategory: r.subcategory,
      priority: r.priority,
      enabled: r.enabled
    }))
  )
}
