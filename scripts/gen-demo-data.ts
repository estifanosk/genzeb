/**
 * Generates realistic 6-month statement CSVs across 5 accounts for demo/testing.
 *
 * Output files (test-data/statements/):
 *   1234_checking_chase_2026-h1.csv        — Main checking: paychecks, rent, CC payments, transfers
 *   5678_checking_bofa_2026-h1.csv         — Secondary checking: utilities, gas, insurance, medical
 *   3456_creditcard_capitalone_2026-h1.csv — Daily spending CC: groceries, dining, coffee, subscriptions
 *   7890_creditcard_amex_2026-h1.csv       — Travel/premium CC: travel, hotels, fine dining, online shopping
 *   9012_savings_ally_2026-h1.csv          — Savings: transfers in, interest income
 *
 * Run: npx tsx scripts/gen-demo-data.ts
 */
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

// Seeded deterministic RNG
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const rand = mulberry32(0xC0FFEE42)

function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)] }
function between(lo: number, hi: number, decimals = 2): number {
  return +(lo + rand() * (hi - lo)).toFixed(decimals)
}
function jitter(base: number, pct = 0.08): number {
  return +(base * (1 + (rand() - 0.5) * 2 * pct)).toFixed(2)
}
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }
function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
function randDay(days: number) { return Math.floor(rand() * days) + 1 }

interface Tx { date: string; description: string; merchant: string; amount: number }

const OUT_DIR = join(__dirname, '../test-data/statements')

// ─── Merchant pools ───────────────────────────────────────────────────────────

const GROCERY    = ['Fresh Market', 'Whole Foods', "Trader Joe's", 'Safeway', 'Kroger', 'Costco', 'Sprouts']
const COFFEE     = ['Starbucks', 'Blue Bottle', "Peet's Coffee", 'Philz Coffee', 'Ritual Coffee', 'Northside Coffee']
const FAST_FOOD  = ['McDonald\'s', 'Taco Bell', 'Chick-fil-A', 'Domino\'s', 'Chipotle', 'Subway', 'Wendy\'s', 'Popeyes']
const CASUAL_DIN = ['Panera Bread', 'Olive Garden', 'Red Robin', 'Applebee\'s', 'Cheesecake Factory', 'Buffalo Wild Wings']
const RIDESHARE  = ['Uber', 'Lyft', 'Metro Ride']
const STREAMING  = ['Netflix', 'Hulu', 'Disney+', 'HBO Max', 'Apple TV+']
const SOFTWARE   = ['Spotify', 'iCloud Storage', 'Adobe Creative', 'Google One', 'Microsoft 365']
const GYM        = ['Planet Fitness', 'LA Fitness', 'Orange Theory']
const PHARMACY   = ['CVS Pharmacy', 'Walgreens', 'Rite Aid']
const UTILITIES  = ['City Power', 'Bay Area Gas Co.', 'Comcast Internet', 'AT&T Wireless', 'Water & Sewer Dept']
const INSURANCE  = ['State Farm Insurance', 'Geico Auto', 'Blue Shield Health']
const GAS_STA    = ['Shell Gas', 'Chevron', 'BP Gas', 'Arco']
const ONLINE_SHP = ['Amazon', 'eBay', 'Etsy', 'Wayfair', 'Chewy']
const RETAIL_SHP = ['Target', 'Walmart', 'Best Buy', 'Home Depot', 'TJ Maxx', 'Nordstrom Rack']
const FINE_DIN   = ['Le Bernardin', 'Nobu', 'The French Laundry', 'Chez Panisse', 'Benu', 'Atelier Crenn']
const HOTELS     = ['Marriott Hotels', 'Hilton', 'Hyatt', 'Airbnb', 'Four Seasons']
const AIRLINES   = ['Delta Airlines', 'United Airlines', 'Alaska Airlines', 'American Airlines', 'Southwest Airlines']
const CAR_RENTAL = ['Enterprise Rent-A-Car', 'Hertz', 'Avis']
const HEALTH_CLI = ['City Medical Group', 'Kaiser Permanente', 'DentalCare Plus']
const ATMS       = ['ATM Withdrawal', 'Bank Fee']
const MISC_MERCH = ['USPS Postage', 'Parking Meter', 'City Parking Garage', 'FedEx Ship']

// ─── Per-account generators ───────────────────────────────────────────────────

/** 1234 — Chase Checking: paychecks, rent, CC payments, transfers, health */
function generateChaseChecking(year: number, month: number): Tx[] {
  const days = daysInMonth(year, month)
  const rows: Tx[] = []
  const d = (n: number, desc: string, merchant: string, amount: number) =>
    rows.push({ date: iso(year, month, n), description: desc, merchant, amount })

  // Paychecks 1st and 15th
  d(1,  'Paycheck direct deposit', 'Acme Corp Payroll', jitter(3450))
  d(15, 'Paycheck direct deposit', 'Acme Corp Payroll', jitter(3450))
  // Rent
  d(2, 'Rent payment', 'Sunset Apartments', -1850)
  // Credit card payment
  d(20, 'Capital One CC payment', 'Capital One', -jitter(1650, 0.15))
  d(22, 'Amex CC payment',        'American Express', -jitter(980, 0.20))
  // Savings transfer
  d(5, 'Transfer to savings', 'Ally Savings', -jitter(500, 0.10))
  // Health / pharmacy (checking-paid)
  for (let i = 0; i < between(2, 4, 0); i++) d(randDay(days), 'Medical co-pay', pick(HEALTH_CLI), -between(25, 85))
  for (let i = 0; i < between(1, 3, 0); i++) d(randDay(days), 'Pharmacy',        pick(PHARMACY),  -between(8, 55))
  // ATM / misc
  for (let i = 0; i < between(1, 3, 0); i++) d(randDay(days), 'Bank/ATM', pick(ATMS), -between(3, 40))

  return rows
}

/** 5678 — BofA Checking: utilities, gas, insurance, car expenses */
function generateBofAChecking(year: number, month: number): Tx[] {
  const days = daysInMonth(year, month)
  const rows: Tx[] = []
  const d = (n: number, desc: string, merchant: string, amount: number) =>
    rows.push({ date: iso(year, month, n), description: desc, merchant, amount })

  // Utilities — fixed monthly bills
  UTILITIES.forEach((u, i) => d(6 + i * 2, `${u} bill`, u, -between(45, 195)))
  // Insurance
  INSURANCE.forEach((ins, i) => d(10 + i, 'Insurance premium', ins, -between(75, 230)))
  // Gas
  for (let i = 0; i < between(3, 5, 0); i++) d(randDay(days), 'Gas fill-up', pick(GAS_STA), -between(38, 82))
  // Car maintenance (occasional)
  if (rand() > 0.65) d(randDay(days), 'Auto service', 'Jiffy Lube', -between(35, 120))
  if (rand() > 0.80) d(randDay(days), 'Auto parts',   'AutoZone',   -between(20, 85))
  // Misc
  for (let i = 0; i < between(2, 4, 0); i++) d(randDay(days), 'Misc', pick(MISC_MERCH), -between(5, 40))

  return rows
}

/** 3456 — Capital One CC: daily spending — groceries, dining, coffee, subscriptions, rideshare */
function generateCapitalOneCC(year: number, month: number): Tx[] {
  const days = daysInMonth(year, month)
  const rows: Tx[] = []
  const d = (n: number, desc: string, merchant: string, amount: number) =>
    rows.push({ date: iso(year, month, n), description: desc, merchant, amount })

  // Subscriptions (fixed billing dates)
  STREAMING.slice(0, 3).forEach((s, i) => d(3 + i, `${s} subscription`, s, -between(8, 23)))
  SOFTWARE.slice(0, 3).forEach((s, i) => d(7 + i, `${s} subscription`, s, -between(3, 12)))
  d(5, 'Gym membership', pick(GYM), -between(25, 55))

  // Groceries (~3–4×/week)
  const grocDays = new Set<number>()
  while (grocDays.size < between(13, 17, 0)) grocDays.add(randDay(days))
  for (const n of grocDays) d(n, 'Grocery purchase', pick(GROCERY), -between(22, 135))

  // Coffee (~4–5×/week)
  const coffeeDays = new Set<number>()
  while (coffeeDays.size < between(18, 24, 0)) coffeeDays.add(randDay(days))
  for (const n of coffeeDays) d(n, 'Coffee', pick(COFFEE), -between(4, 14))

  // Fast food (~3–4×/week)
  const fastDays = new Set<number>()
  while (fastDays.size < between(14, 20, 0)) fastDays.add(randDay(days))
  for (const n of fastDays) d(n, 'Fast food', pick(FAST_FOOD), -between(8, 28))

  // Casual dining (~2–3×/week)
  const casualDays = new Set<number>()
  while (casualDays.size < between(10, 14, 0)) casualDays.add(randDay(days))
  for (const n of casualDays) d(n, 'Restaurant', pick(CASUAL_DIN), -between(18, 65))

  // Rideshare (~3×/week)
  for (let i = 0; i < between(12, 16, 0); i++) d(randDay(days), 'Rideshare', pick(RIDESHARE), -between(9, 38))

  // Retail shopping
  for (let i = 0; i < between(8, 14, 0); i++) d(randDay(days), 'Shopping', pick(RETAIL_SHP), -between(15, 180))

  // Online shopping
  for (let i = 0; i < between(5, 9, 0); i++) d(randDay(days), 'Online purchase', pick(ONLINE_SHP), -between(12, 120))

  return rows
}

/** 7890 — Amex: travel, fine dining, premium online shopping */
function generateAmexCC(year: number, month: number): Tx[] {
  const days = daysInMonth(year, month)
  const rows: Tx[] = []
  const d = (n: number, desc: string, merchant: string, amount: number) =>
    rows.push({ date: iso(year, month, n), description: desc, merchant, amount })

  // Annual fee amortised (once in Jan)
  if (month === 1) d(1, 'Annual fee', 'American Express', -695)

  // Premium online shopping (~8/month)
  for (let i = 0; i < between(6, 10, 0); i++) d(randDay(days), 'Online purchase', pick(ONLINE_SHP), -between(25, 320))

  // Fine dining (~2–3×/month)
  for (let i = 0; i < between(2, 4, 0); i++) d(randDay(days), 'Fine dining', pick(FINE_DIN), -between(65, 280))

  // Travel (heavier in Feb and May — vacations)
  const isVacationMonth = month === 2 || month === 5
  if (isVacationMonth) {
    d(randDay(days), 'Flight',      pick(AIRLINES),   -between(180, 850))
    d(randDay(days), 'Hotel stay',  pick(HOTELS),     -between(180, 650))
    d(randDay(days), 'Car rental',  pick(CAR_RENTAL), -between(80, 220))
    for (let i = 0; i < between(1, 3, 0); i++) d(randDay(days), 'Travel dining', pick(FINE_DIN), -between(45, 180))
  }
  // Occasional travel in other months
  if (!isVacationMonth && rand() > 0.5) {
    d(randDay(days), 'Flight', pick(AIRLINES), -between(120, 450))
    if (rand() > 0.4) d(randDay(days), 'Hotel stay', pick(HOTELS), -between(120, 380))
  }

  // Misc premium (Uber Eats, lounges, etc.)
  for (let i = 0; i < between(3, 6, 0); i++) d(randDay(days), 'Misc', pick(['Uber Eats', 'DoorDash', 'Priority Pass', 'TSA PreCheck']), -between(12, 85))

  return rows
}

/** 9012 — Ally Savings: transfers in, interest */
function generateAllySavings(year: number, month: number): Tx[] {
  const rows: Tx[] = []
  const d = (n: number, desc: string, merchant: string, amount: number) =>
    rows.push({ date: iso(year, month, n), description: desc, merchant, amount })

  d(6,  'Transfer from Chase Checking', 'Chase Bank',   jitter(500, 0.10))
  d(28, 'Interest earned',              'Ally Bank',    +between(8, 22))

  return rows
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const accounts = [
  { file: '1234_checking_chase_2026-h1.csv',        gen: generateChaseChecking   },
  { file: '5678_checking_bofa_2026-h1.csv',         gen: generateBofAChecking    },
  { file: '3456_creditcard_capitalone_2026-h1.csv', gen: generateCapitalOneCC    },
  { file: '7890_creditcard_amex_2026-h1.csv',       gen: generateAmexCC          },
  { file: '9012_savings_ally_2026-h1.csv',          gen: generateAllySavings     },
]

mkdirSync(OUT_DIR, { recursive: true })

const grandTotal = { files: 0, rows: 0 }

for (const acct of accounts) {
  const rows: Tx[] = []
  for (let m = 0; m < 6; m++) {
    rows.push(...acct.gen(2026, m + 1))
  }
  rows.sort((a, b) => a.date.localeCompare(b.date))

  const csv = ['Date,Description,Merchant,Amount',
    ...rows.map(r => `${r.date},${r.description},${r.merchant},${r.amount.toFixed(2)}`)
  ].join('\n') + '\n'

  writeFileSync(join(OUT_DIR, acct.file), csv, 'utf-8')

  // Per-month stats
  const byMonth: Record<string, number> = {}
  for (const r of rows) { const k = r.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + 1 }
  const perMonth = Object.values(byMonth).map(String).join(', ')
  console.log(`${acct.file.padEnd(48)} ${String(rows.length).padStart(4)} rows  [${perMonth}]`)
  grandTotal.rows += rows.length
  grandTotal.files++
}

console.log(`\n${grandTotal.files} files  •  ${grandTotal.rows} total transactions`)
console.log(`Written to ${OUT_DIR}`)
