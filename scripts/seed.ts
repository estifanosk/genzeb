/**
 * LedgerBox Seed Script
 *
 * Generates realistic test data for manual testing and development:
 *   - 4 accounts: 2 checking, 1 savings, 1 credit card
 *   - ~3 months of transactions (~200 rows)
 *   - SVG receipt images for ~10% of transactions
 *   - Receipt detail JSON with line items (simulates LLM OCR output)
 *   - Category assignments for all transactions
 *
 * Phases
 * ------
 *   1. Build transaction rows (merchants, categories, line items)
 *   2. Write CSV statement files to a temp staging dir
 *   3. Import CSVs into the data folder via core importer
 *   4. Initial materialize → get transaction IDs
 *   5. Generate SVG receipt images + detail JSON for ~10% of transactions
 *   6. Write receipt index entries and link to transactions via changes
 *   7. Assign categories to all transactions via changes
 *   8. Final materialize to apply all changes
 *
 * Usage (run from app/)
 * -----
 *   NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/seed.ts [data-folder]
 *
 * Defaults to ~/Documents/LedgerBox if no argument is given.
 * Safe to re-run after clean.ts has wiped the data folder.
 */

import { mkdirSync, writeFileSync, existsSync, appendFileSync, rmSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { v4 as uuidv4 } from 'uuid'
import { importStatementFiles } from '../core/importer/statement-importer'
import { materializeTransactions, queryTransactions } from '../core/materializer/index'
import { appendChangeRow } from '../core/ledger/changes'
import { ensureDataStructure, getDataFilePath, getDataDirPath } from '../core/storage/paths'
import type { ReceiptDetail, ReceiptIndexRow } from '../core/types'

// ── config ─────────────────────────────────────────────────────────────────────

const DATA_FOLDER = process.argv[2] || join(homedir(), 'Documents', 'LedgerBox')
const STAGING_DIR = join(DATA_FOLDER, '_seed_staging')

// Reproducible random (simple LCG seeded at 42)
let _seed = 42
function rand(): number {
  _seed = (_seed * 1664525 + 1013904223) & 0xffffffff
  return ((_seed >>> 0) / 0xffffffff)
}
function randInt(lo: number, hi: number): number {
  return Math.floor(rand() * (hi - lo + 1)) + lo
}
function randFloat(lo: number, hi: number): number {
  return Math.round((rand() * (hi - lo) + lo) * 100) / 100
}
function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)]
}
function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, n)
}

// ── date helpers ────────────────────────────────────────────────────────────────

const END_DATE = new Date('2026-05-31')
const START_DATE = new Date('2026-03-01')

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function randDate(start = START_DATE, end = END_DATE): Date {
  const ms = start.getTime() + rand() * (end.getTime() - start.getTime())
  return new Date(ms)
}
function monthRange(start: Date, end: Date): Date[] {
  const months: Date[] = []
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cur <= end) {
    months.push(new Date(cur))
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

// ── accounts ────────────────────────────────────────────────────────────────────

const ACCOUNTS = [
  { number: '1234', type: 'checking', bank: 'chase',        label: 'Chase Checking' },
  { number: '5678', type: 'checking', bank: 'bankofamerica', label: 'BofA Checking' },
  { number: '9012', type: 'savings',  bank: 'ally',          label: 'Ally Savings' },
  { number: '3456', type: 'creditcard', bank: 'capitalone',  label: 'Capital One CC' },
]

// ── merchant data ───────────────────────────────────────────────────────────────

const GROCERY: Array<[string, string, string[], [number, number]]> = [
  ['Whole Foods Market', 'Groceries', ['Organic Milk 1gal','Sourdough Bread','Baby Spinach 5oz','Free-Range Eggs 12ct','Greek Yogurt 32oz','Avocados 4ct','Almond Butter 16oz','Olive Oil 500ml','Chicken Breast 2lb','Blueberries 6oz'], [45, 180]],
  ["Trader Joe's", 'Groceries', ['Everything But Bagel Seasoning','Mandarin Oranges 3lb','Cauliflower Gnocchi 12oz','Peanut Butter Cups','Frozen Burritos 4pk','Chile Lime Chicken','Organic Bananas','Dark Chocolate Bar','Frozen Orange Chicken 22oz','Tzatziki Dip 12oz'], [30, 120]],
  ['Kroger', 'Groceries', ['2% Milk 1gal','White Bread Loaf','Cheddar Cheese 16oz','Pasta 16oz','Tomato Sauce 24oz','Ground Beef 1lb','Frozen Pizza','Orange Juice 52oz','Cereal 18oz','Dish Soap'], [35, 110]],
  ['Safeway', 'Groceries', ['Apples 3lb bag','Baby Carrots 1lb','Strawberries 1lb','Brown Rice 2lb','Spaghetti 16oz','Butter 1lb','Chips Ahoy 13oz','Wine 750ml','Beer 6pk','Sour Cream 16oz'], [40, 130]],
]

const DINING: Array<[string, string, string[], [number, number]]> = [
  ['Starbucks', 'Coffee', ['Venti Latte','Grande Cold Brew','Caramel Macchiato','Blueberry Scone','Avocado Spread Toast','Cheese Danish','Egg Bites 2pk'], [5, 22]],
  ['Chipotle Mexican Grill', 'Dining', ['Burrito Bowl - Chicken','Burrito - Steak','Tacos 3 - Carnitas','Chips & Guacamole','Large Drink'], [9, 35]],
  ["McDonald's", 'Dining', ['Big Mac Meal','Quarter Pounder w/Cheese','Chicken McNuggets 10pc','Large Fries','McFlurry Oreo','Egg McMuffin'], [6, 28]],
  ['Panera Bread', 'Dining', ['Broccoli Cheddar Soup Bowl','Turkey Sandwich','Caesar Salad','Bagel with Cream Cheese','You Pick Two Combo'], [8, 30]],
  ['The Cheesecake Factory', 'Dining', ['Pasta Carbonara','Chicken Piccata','Fresh Strawberry Cheesecake','Margherita Pizza','Chicken Madeira','House Salad','Cocktail'], [18, 95]],
  ['Panda Express', 'Dining', ['Orange Chicken Bowl','Fried Rice','Chow Mein','Spring Roll','Honey Walnut Shrimp','Cream Cheese Rangoon 3pk'], [8, 28]],
  ['Local Sushi Bar', 'Dining', ['Dragon Roll 8pc','Salmon Nigiri 2pc','Spicy Tuna Roll','Miso Soup','Edamame','Sake 180ml','Tempura Udon'], [18, 80]],
]

const GAS: Array<[string, string, [number, number]]> = [
  ['Shell Gas Station', 'Gas', [35, 85]],
  ['BP Gas Station', 'Gas', [30, 80]],
  ['Chevron', 'Gas', [32, 82]],
  ['ExxonMobil', 'Gas', [28, 78]],
]

const SUBSCRIPTIONS: Array<[string, string, [number, number]]> = [
  ['Netflix', 'Entertainment', [15.49, 22.99]],
  ['Spotify Premium', 'Entertainment', [9.99, 9.99]],
  ['Amazon Prime', 'Shopping', [14.99, 14.99]],
  ['Hulu', 'Entertainment', [7.99, 17.99]],
  ['Apple iCloud+', 'Subscriptions', [0.99, 9.99]],
  ['YouTube Premium', 'Entertainment', [13.99, 13.99]],
  ['Microsoft 365', 'Subscriptions', [9.99, 9.99]],
  ['Planet Fitness', 'Health', [24.99, 24.99]],
]

const SHOPPING: Array<[string, string, string[], [number, number]]> = [
  ['Amazon', 'Shopping', ['USB-C Cable 6ft','Phone Case','Wireless Earbuds','HDMI Cable 10ft','Notebook 3pk','LED Desk Lamp','Protein Powder 5lb','Yoga Mat','Smart Plug 4pk','Vitamins 120ct'], [15, 250]],
  ['Target', 'Shopping', ['Bath Towel Set','Throw Pillow 2pk','Scented Candle','Storage Bins 3pk','Mens T-Shirts 3pk','Toothpaste 3pk','Shampoo 28oz','Laundry Pods 81ct'], [20, 150]],
  ['Best Buy', 'Electronics', ['AA Batteries 20pk','Screen Protector','Surge Protector 6-Outlet','External SSD 1TB','Webcam 1080p','Mechanical Keyboard','Mouse Wireless'], [15, 400]],
  ['Home Depot', 'Home', ['Drill Bit Set 10pc','Paint Roller Kit','Interior Paint 1gal','LED Bulbs 6pk','Caulk Gun','Wood Glue 8oz','Extension Ladder 8ft'], [15, 180]],
]

const UTILITIES: Array<[string, string, [number, number]]> = [
  ['Pacific Gas & Electric', 'Utilities', [80, 200]],
  ['Comcast Internet', 'Utilities', [75, 110]],
  ['AT&T Wireless', 'Utilities', [55, 140]],
  ['City Water Dept', 'Utilities', [35, 90]],
  ['Progressive Insurance', 'Insurance', [110, 220]],
]

const TRAVEL: Array<[string, string, [number, number]]> = [
  ['United Airlines', 'Travel', [180, 650]],
  ['Marriott Hotels', 'Travel', [120, 320]],
  ['Airbnb', 'Travel', [80, 400]],
  ['Uber', 'Transportation', [8, 45]],
  ['Lyft', 'Transportation', [7, 42]],
]

const HEALTH: Array<[string, string, string[], [number, number]]> = [
  ['CVS Pharmacy', 'Health', ['Cold Medicine DayQuil','Ibuprofen 200ct','Bandages Assortment','Vitamin D 90ct','Allergy Medicine 45ct','Thermometer Digital'], [8, 85]],
  ['Walgreens', 'Health', ['Melatonin 5mg 60ct','Zinc 50mg 100ct','Hand Sanitizer 12oz','Face Moisturizer SPF 30','Sunscreen SPF 50','Probiotic 30ct'], [8, 70]],
]

// ── line item builder ───────────────────────────────────────────────────────────

type LineItemData = { description: string; quantity: number; unit_price: number; total: number; category_hint: string }

function makeLineItems(templates: string[], targetTotal: number, category: string): LineItemData[] {
  if (!templates.length) return []
  const n = randInt(2, Math.min(6, templates.length))
  const chosen = sample(templates, n)
  const pretax = targetTotal * randFloat(0.82, 0.92)
  const weights = chosen.map(() => randFloat(0.5, 3.0))
  const totalW = weights.reduce((a, b) => a + b, 0)
  return chosen.map((desc, i) => {
    const qty = pick([1, 1, 1, 2, 2, 3])
    const unit = Math.round((pretax * weights[i] / totalW) / qty * 100) / 100
    return { description: desc, quantity: qty, unit_price: unit, total: Math.round(unit * qty * 100) / 100, category_hint: category }
  })
}

// ── transaction row builder ─────────────────────────────────────────────────────

type TxRow = {
  account: string
  date: string
  description: string
  merchant: string
  amount: number
  category: string
  lineItems: LineItemData[]
}

function buildRows(): TxRow[] {
  const rows: TxRow[] = []
  const ch1 = '1234', ch2 = '5678', sav = '9012', cc = '3456'

  function push(account: string, date: Date, description: string, merchant: string, amount: number, category: string, lineItems: LineItemData[] = []) {
    rows.push({ account, date: fmtDate(date), description, merchant, amount, category, lineItems })
  }

  // Paychecks twice/month (checking1)
  for (const m of monthRange(START_DATE, END_DATE)) {
    for (const day of [1, 15]) {
      const d = new Date(m.getFullYear(), m.getMonth(), day)
      if (d >= START_DATE && d <= END_DATE) {
        push(ch1, d, 'Direct Deposit - Acme Corp Payroll', 'Acme Corp', randFloat(3200, 5500), 'Income')
      }
    }
  }

  // Monthly savings transfer
  for (const m of monthRange(START_DATE, END_DATE)) {
    const d = new Date(m.getFullYear(), m.getMonth(), 5)
    if (d >= START_DATE && d <= END_DATE) {
      const amt = randFloat(300, 800)
      push(ch1, d, 'Transfer to Ally Savings', 'Ally Bank', -amt, 'Transfer')
      push(sav, d, 'Transfer from Chase Checking', 'Chase Bank', amt, 'Transfer')
    }
  }

  // Monthly CC payment
  for (const m of monthRange(START_DATE, END_DATE)) {
    const d = new Date(m.getFullYear(), m.getMonth(), 20)
    if (d >= START_DATE && d <= END_DATE) {
      const amt = randFloat(800, 2200)
      push(ch1, d, 'Capital One Credit Card Payment', 'Capital One', -amt, 'Payment')
      push(cc,  d, 'Payment Received - Thank You', 'Capital One', amt, 'Payment')
    }
  }

  // Monthly utilities (checking2)
  for (const m of monthRange(START_DATE, END_DATE)) {
    for (const [name, category, [lo, hi]] of UTILITIES) {
      const d = new Date(m.getFullYear(), m.getMonth(), randInt(1, 28))
      if (d >= START_DATE && d <= END_DATE) {
        push(ch2, d, name, name, -randFloat(lo, hi), category)
      }
    }
  }

  // Monthly subscriptions (CC)
  for (const m of monthRange(START_DATE, END_DATE)) {
    for (const [name, category, [lo, hi]] of SUBSCRIPTIONS) {
      const d = new Date(m.getFullYear(), m.getMonth(), randInt(1, 28))
      if (d >= START_DATE && d <= END_DATE) {
        push(cc, d, name, name, -randFloat(lo, hi), category)
      }
    }
  }

  // Groceries 2-3x/week (CC) with line items
  let cur = new Date(START_DATE)
  while (cur <= END_DATE) {
    const count = randInt(1, 3)
    for (let i = 0; i < count; i++) {
      const d = addDays(cur, randInt(0, 6))
      if (d > END_DATE) continue
      const [name, category, templates, [lo, hi]] = pick(GROCERY)
      const amt = randFloat(lo, hi)
      push(cc, d, name, name, -amt, category, makeLineItems(templates, amt, category))
    }
    cur = addDays(cur, 7)
  }

  // Dining 3-5x/week (CC) with line items
  cur = new Date(START_DATE)
  while (cur <= END_DATE) {
    const count = randInt(2, 4)
    for (let i = 0; i < count; i++) {
      const d = addDays(cur, randInt(0, 6))
      if (d > END_DATE) continue
      const [name, category, templates, [lo, hi]] = pick(DINING)
      const amt = randFloat(lo, hi)
      push(cc, d, name, name, -amt, category, makeLineItems(templates, amt, category))
    }
    cur = addDays(cur, 7)
  }

  // Gas every 10-14 days (checking2)
  cur = new Date(START_DATE)
  while (cur <= END_DATE) {
    const [name, category, [lo, hi]] = pick(GAS)
    push(ch2, cur, name, name, -randFloat(lo, hi), category)
    cur = addDays(cur, randInt(10, 14))
  }

  // Shopping ~15 transactions (CC) with line items
  for (let i = 0; i < 15; i++) {
    const [name, category, templates, [lo, hi]] = pick(SHOPPING)
    const amt = randFloat(lo, hi)
    push(cc, randDate(), name, name, -amt, category, makeLineItems(templates, amt, category))
  }

  // Travel ~4 transactions (CC)
  for (let i = 0; i < 4; i++) {
    const [name, category, [lo, hi]] = pick(TRAVEL)
    push(cc, randDate(), name, name, -randFloat(lo, hi), category)
  }

  // Health / pharmacy ~8 transactions (checking1)
  for (let i = 0; i < 8; i++) {
    const [name, category, templates, [lo, hi]] = pick(HEALTH)
    const amt = randFloat(lo, hi)
    push(ch1, randDate(), name, name, -amt, category, makeLineItems(templates, amt, category))
  }

  // Savings interest monthly
  for (const m of monthRange(START_DATE, END_DATE)) {
    const d = new Date(m.getFullYear(), m.getMonth(), 28)
    if (d >= START_DATE && d <= END_DATE) {
      push(sav, d, 'Interest Payment', 'Ally Bank', randFloat(1, 25), 'Income')
    }
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

// ── CSV writer ──────────────────────────────────────────────────────────────────

function writeStatementCSVs(rows: TxRow[]): string[] {
  mkdirSync(STAGING_DIR, { recursive: true })

  const byAccount: Record<string, TxRow[]> = {}
  for (const row of rows) {
    if (!byAccount[row.account]) byAccount[row.account] = []
    byAccount[row.account].push(row)
  }

  const paths: string[] = []
  for (const acct of ACCOUNTS) {
    const acctRows = byAccount[acct.number] || []
    if (!acctRows.length) continue
    const period = `${fmtDate(START_DATE).slice(0, 7)}-to-${fmtDate(END_DATE).slice(0, 7)}`
    const filename = `${acct.number}_${acct.type}_${acct.bank}_${period}.csv`
    const filepath = join(STAGING_DIR, filename)
    const lines = ['Date,Description,Merchant,Amount']
    for (const r of acctRows) {
      lines.push(`${r.date},${escapeCsv(r.description)},${escapeCsv(r.merchant)},${r.amount.toFixed(2)}`)
    }
    writeFileSync(filepath, lines.join('\n') + '\n', 'utf-8')
    paths.push(filepath)
    console.log(`  ${filename}: ${acctRows.length} rows`)
  }
  return paths
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

// ── SVG receipt generator ───────────────────────────────────────────────────────

function generateReceiptSVG(merchant: string, date: string, amount: number, items: LineItemData[]): string {
  const W = 360
  const ROW_H = 18
  const lines: string[] = []

  const t = (y: number, content: string, opts: { x?: number; bold?: boolean; size?: number; align?: 'left'|'center'|'right'; color?: string } = {}) => {
    const { x = 20, bold = false, size = 12, align = 'left', color = '#222' } = opts
    const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
    const rx = align === 'center' ? W / 2 : align === 'right' ? W - 20 : x
    lines.push(`  <text x="${rx}" y="${y}" font-size="${size}" font-weight="${bold ? 'bold' : 'normal'}" text-anchor="${anchor}" fill="${color}">${content}</text>`)
  }
  const hr = (y: number, dashed = false) => {
    const dash = dashed ? ' stroke-dasharray="4 3"' : ''
    lines.push(`  <line x1="16" y1="${y}" x2="${W - 16}" y2="${y}" stroke="#ccc" stroke-width="1"${dash}/>`)
  }

  const nRows = 6 + items.length + (items.length ? 3 : 0)
  const H = nRows * ROW_H + 60

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="font-family:'Courier New',monospace;background:#fff;">`)
  lines.push(`  <rect width="${W}" height="${H}" fill="#fff" rx="4"/>`)

  let y = 28
  t(y, merchant, { align: 'center', bold: true, size: 14 }); y += ROW_H
  t(y, 'RECEIPT', { align: 'center', size: 11, color: '#888' }); y += ROW_H - 4
  t(y, date, { align: 'center', size: 10, color: '#666' }); y += ROW_H
  hr(y); y += 10

  if (items.length) {
    t(y, 'ITEM', { size: 10, color: '#555', bold: true })
    t(y, 'QTY', { x: 205, size: 10, color: '#555', bold: true })
    t(y, 'TOTAL', { size: 10, color: '#555', bold: true, align: 'right' })
    y += ROW_H - 2
    hr(y, true); y += 8
    let subtotal = 0
    for (const item of items) {
      subtotal += item.total
      const desc = item.description.length > 26 ? item.description.slice(0, 26) : item.description
      t(y, desc, { size: 10 })
      t(y, String(item.quantity), { x: 205, size: 10 })
      t(y, `$${item.total.toFixed(2)}`, { size: 10, align: 'right' })
      y += ROW_H - 2
    }
    hr(y, true); y += 10
    const tax = Math.max(0, Math.round((amount - subtotal) * 100) / 100)
    if (tax > 0) {
      t(y, 'Subtotal', { size: 10, color: '#555' })
      t(y, `$${subtotal.toFixed(2)}`, { size: 10, align: 'right' }); y += ROW_H - 2
      t(y, 'Tax', { size: 10, color: '#555' })
      t(y, `$${tax.toFixed(2)}`, { size: 10, align: 'right' }); y += ROW_H - 2
    }
  }

  hr(y); y += 10
  t(y, 'TOTAL', { bold: true, size: 13 })
  t(y, `$${amount.toFixed(2)}`, { size: 13, bold: true, align: 'right' })
  y += ROW_H + 4
  t(y, 'Thank you!', { align: 'center', size: 10, color: '#888' })
  lines.push('</svg>')
  return lines.join('\n')
}

// ── receipt index writer ────────────────────────────────────────────────────────

function appendReceiptIndex(dataFolder: string, row: ReceiptIndexRow): void {
  const indexPath = getDataFilePath(dataFolder, 'RECEIPTS_INDEX')
  const headers = ['receipt_id','file_path','receipt_type','merchant','date','total','currency','source_hash','ocr_status','created_at']
  const needsHeader = !existsSync(indexPath)
  if (needsHeader) writeFileSync(indexPath, headers.join(',') + '\n', 'utf-8')
  const values = headers.map(h => {
    const v = String((row as Record<string, unknown>)[h] ?? '')
    return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v
  })
  appendFileSync(indexPath, values.join(',') + '\n', 'utf-8')
}

// ── main ────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== LedgerBox Seed ===\n')
  console.log('Data folder:', DATA_FOLDER)

  ensureDataStructure(DATA_FOLDER)

  // Phase 1: Build rows
  console.log('\n── Phase 1: build transaction rows ──────────────────────')
  const rows = buildRows()
  const withItems = rows.filter(r => r.lineItems.length > 0)
  console.log(`  ${rows.length} transactions  •  ${withItems.length} with line items`)

  // Phase 2: Write CSVs
  console.log('\n── Phase 2: write CSV statement files ───────────────────')
  const csvPaths = writeStatementCSVs(rows)

  // Phase 3: Import
  console.log('\n── Phase 3: import CSVs ─────────────────────────────────')
  for (const csvPath of csvPaths) {
    const results = await importStatementFiles(DATA_FOLDER, { paths: [csvPath] })
    for (const r of results) {
      console.log(`  ${r.source_file}: ${r.rows_imported} imported, ${r.rows_skipped} skipped`)
    }
  }

  // Phase 4: Initial materialize to get transaction IDs
  console.log('\n── Phase 4: initial materialize ─────────────────────────')
  materializeTransactions(DATA_FOLDER)
  const { transactions } = queryTransactions(DATA_FOLDER, { limit: 9999 })
  console.log(`  ${transactions.length} transactions materialized`)

  // Phase 5+6: Receipts for ~10% of transactions that have line items
  console.log('\n── Phase 5: generate receipts ───────────────────────────')
  const receiptCandidates = transactions.filter(tx => {
    // Match back to the seed row to get line items
    const seedRow = rows.find(r => r.merchant === tx.merchant && r.date === tx.date && Math.abs(r.amount - tx.amount) < 0.01)
    return seedRow && seedRow.lineItems.length > 0
  })
  const receiptTargets = sample(receiptCandidates, Math.round(transactions.length * 0.10))
  const receiptDir = getDataDirPath(DATA_FOLDER, 'RECEIPTS')

  let receiptCount = 0
  for (const tx of receiptTargets) {
    const seedRow = rows.find(r => r.merchant === tx.merchant && r.date === tx.date && Math.abs(r.amount - tx.amount) < 0.01)
    if (!seedRow) continue

    const receiptId = uuidv4()
    const svgPath = join(receiptDir, `${receiptId}.svg`)
    const svgContent = generateReceiptSVG(tx.merchant, tx.date, Math.abs(tx.amount), seedRow.lineItems)
    writeFileSync(svgPath, svgContent, 'utf-8')

    // Write receipt detail JSON (simulates LLM OCR output)
    const detail: ReceiptDetail = {
      receipt_id: receiptId,
      file_path: svgPath,
      merchant: tx.merchant,
      date: tx.date,
      total: Math.abs(tx.amount),
      currency: 'USD',
      confidence: 0.95,
      line_items: seedRow.lineItems.map(item => ({
        line_item_id: uuidv4(),
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total: item.total,
        category_hint: item.category_hint,
        confidence: 0.9
      })),
    }
    writeFileSync(join(receiptDir, `${receiptId}.json`), JSON.stringify(detail, null, 2), 'utf-8')

    // Write to receipt index
    appendReceiptIndex(DATA_FOLDER, {
      receipt_id: receiptId,
      file_path: svgPath,
      receipt_type: 'image',
      merchant: tx.merchant,
      date: tx.date,
      total: Math.abs(tx.amount),
      currency: 'USD',
      source_hash: receiptId,
      ocr_status: 'ok',
      created_at: new Date().toISOString()
    })

    // Link receipt to transaction
    appendChangeRow(DATA_FOLDER, {
      transaction_id: tx.id,
      change_type: 'link_receipt',
      value: receiptId
    })

    receiptCount++
  }
  console.log(`  Generated ${receiptCount} receipts with line items`)

  // Phase 7: Assign categories
  console.log('\n── Phase 6: assign categories ───────────────────────────')
  let categorized = 0
  for (const tx of transactions) {
    const seedRow = rows.find(r => r.merchant === tx.merchant && r.date === tx.date && Math.abs(r.amount - tx.amount) < 0.01)
    if (!seedRow?.category) continue
    appendChangeRow(DATA_FOLDER, {
      transaction_id: tx.id,
      change_type: 'set_category',
      value: seedRow.category
    })
    categorized++
  }
  console.log(`  Categorized ${categorized} transactions`)

  // Phase 8: Final materialize
  console.log('\n── Phase 7: final materialize ───────────────────────────')
  materializeTransactions(DATA_FOLDER)
  const final = queryTransactions(DATA_FOLDER, { limit: 9999 })
  console.log(`  ${final.total} transactions ready`)

  // Cleanup staging dir
  if (existsSync(STAGING_DIR)) rmSync(STAGING_DIR, { recursive: true })

  console.log('\n=== Done ===')
  console.log(`  Data folder: ${DATA_FOLDER}`)
  console.log(`  Transactions: ${final.total}`)
  console.log(`  Receipts: ${receiptCount}`)
  console.log('\nReload the app with Cmd+R to see the data.')
}

main().catch(err => { console.error('\nFAILED:', err.message); console.error(err.stack); process.exit(1) })
