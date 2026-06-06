/**
 * Generates a realistic 6-month checking account CSV for demo/testing.
 * Output: test-data/statements/1234_checking_demo-bank_large.csv
 * Run: npx tsx scripts/gen-demo-data.ts
 */
import { writeFileSync } from 'fs'
import { join } from 'path'

// Seeded RNG so output is deterministic
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const rand = mulberry32(0xDEADBEEF)

function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)] }
function between(lo: number, hi: number, decimals = 2): number {
  const v = lo + rand() * (hi - lo)
  return +v.toFixed(decimals)
}
function jitter(base: number, pct = 0.15): number {
  return +(base * (1 + (rand() - 0.5) * 2 * pct)).toFixed(2)
}

// Date helpers
function addDays(date: Date, n: number): Date {
  const d = new Date(date); d.setDate(d.getDate() + n); return d
}
function iso(d: Date): string { return d.toISOString().slice(0, 10) }
function daysInMonth(y: number, m: number): number { return new Date(y, m, 0).getDate() }

// ─── Merchant pools ──────────────────────────────────────────────────────────
const GROCERY = ['Fresh Market', 'Whole Foods', 'Trader Joe\'s', 'Safeway', 'Kroger', 'Costco']
const COFFEE   = ['Northside Coffee', 'Blue Bottle', 'Starbucks', 'Peet\'s Coffee', 'Philz Coffee', 'Ritual Coffee']
const LUNCH    = ['Chipotle', 'Sweetgreen', 'Panera Bread', 'Subway', 'Five Guys', 'In-N-Out']
const DINNER   = ['Harbor Table', 'Chez Pierre', 'Sakura Sushi', 'The Burger Joint', 'El Rancho', 'Olive Garden', 'Red Robin', 'Applebee\'s']
const FAST     = ['McDonald\'s', 'Taco Bell', 'Chick-fil-A', 'Domino\'s', 'Pizza Hut', 'Wendy\'s', 'Popeyes']
const GAS      = ['Shell Gas', 'Chevron', 'BP Gas', 'Arco', 'Valero']
const RIDE     = ['Uber', 'Lyft', 'Metro Ride', 'Bird Scooter']
const STREAM   = ['Netflix', 'Spotify', 'Hulu', 'Disney+', 'HBO Max', 'Apple TV+']
const SOFTWARE = ['iCloud Storage', 'Adobe Creative', 'Dropbox', 'Google One', 'Notion']
const GYM      = ['Planet Fitness', 'LA Fitness', 'Orange Theory', 'SoulCycle']
const SHOPPING = ['Amazon', 'Target', 'Walmart', 'Best Buy', 'Home Depot', 'IKEA', 'TJ Maxx', 'Nordstrom', 'Macy\'s', 'eBay']
const PHARMACY = ['CVS Pharmacy', 'Walgreens', 'Rite Aid']
const HEALTH   = ['City Medical Group', 'Kaiser Permanente', 'DentalCare Plus', 'Vision Plus']
const UTILITY  = ['City Power', 'Bay Area Gas', 'Comcast Internet', 'AT&T Wireless', 'Water & Sewer Dept']
const BANK     = ['ATM Withdrawal', 'Bank Fee', 'Wire Transfer Fee']
const ENTERTAIN= ['AMC Theatres', 'Regal Cinemas', 'Dave & Buster\'s', 'Topgolf', 'Mini Golf World']
const PET      = ['Petco', 'PetSmart', 'Happy Paws Vet']
const TRAVEL   = ['Alaska Airlines', 'Delta Airlines', 'Airbnb', 'Marriott Hotels', 'Enterprise Rent-A-Car']
const MISC     = ['USPS Postage', 'FedEx Ship', 'Parking Meter', 'City Parking Garage', 'Library Fine']
const BARS     = ['The Tap Room', 'Rooftop Lounge', 'O\'Malley\'s Bar', 'Craft Beer Co.', 'Wine & Spirits Shop']
const HOME     = ['Home Depot', 'Lowe\'s', 'Ace Hardware', 'IKEA', 'Bed Bath & Beyond', 'The Container Store']
const CLOTHING = ['H&M', 'Zara', 'Gap', 'Old Navy', 'Nike Store', 'Uniqlo', 'Adidas']
const INSURANCE= ['State Farm Insurance', 'Geico Auto', 'Progressive Insurance']

interface Tx { date: string; description: string; merchant: string; amount: number }

function addTx(rows: Tx[], date: Date, desc: string, merchant: string, amount: number) {
  rows.push({ date: iso(date), description: desc, merchant, amount })
}

const rows: Tx[] = []

// 6 months: Jan 2026 – Jun 2026
for (let m = 0; m < 6; m++) {
  const year = 2026
  const month = m + 1  // 1-based
  const days = daysInMonth(year, month)

  // ── Paychecks (1st and 15th) ────────────────────────────────────────────
  addTx(rows, new Date(year, m, 1), 'Paycheck deposit', 'Acme Payroll', jitter(3200, 0.02))
  addTx(rows, new Date(year, m, 15), 'Paycheck deposit', 'Acme Payroll', jitter(3200, 0.02))

  // ── Rent (1st) ──────────────────────────────────────────────────────────
  addTx(rows, new Date(year, m, 2), 'Monthly rent', 'Sunset Apartments', -1850)

  // ── Monthly subscriptions (fixed day each month) ────────────────────────
  STREAM.slice(0, 3).forEach((s, i) => {
    addTx(rows, new Date(year, m, 3 + i), `${s} subscription`, s, -between(7, 18))
  })
  SOFTWARE.slice(0, 2).forEach((s, i) => {
    addTx(rows, new Date(year, m, 7 + i), `${s} subscription`, s, -between(3, 12))
  })
  const gym = pick(GYM)
  addTx(rows, new Date(year, m, 5), 'Monthly gym membership', gym, -between(25, 55))

  // ── Utilities (monthly, spread through first half) ──────────────────────
  UTILITY.forEach((u, i) => {
    addTx(rows, new Date(year, m, 8 + i * 2), `${u} payment`, u, -between(45, 190))
  })

  // ── Groceries (3-4x per week, spread across the month) ──────────────────
  const groceryDays = new Set<number>()
  while (groceryDays.size < between(13, 17, 0)) {
    groceryDays.add(Math.floor(rand() * days) + 1)
  }
  for (const d of Array.from(groceryDays).sort((a, b) => a - b)) {
    const m_ = pick(GROCERY)
    addTx(rows, new Date(year, m, d), 'Grocery purchase', m_, -between(18, 145))
  }

  // ── Coffee (4-5x per week) ───────────────────────────────────────────────
  const coffeeDays = new Set<number>()
  while (coffeeDays.size < between(20, 25, 0)) {
    coffeeDays.add(Math.floor(rand() * days) + 1)
  }
  for (const d of Array.from(coffeeDays).sort((a, b) => a - b)) {
    addTx(rows, new Date(year, m, d), 'Coffee purchase', pick(COFFEE), -between(4, 12))
  }

  // ── Lunch (weekdays, ~5x/week = ~22/month) ──────────────────────────────
  const lunchDays = new Set<number>()
  while (lunchDays.size < between(22, 28, 0)) {
    lunchDays.add(Math.floor(rand() * days) + 1)
  }
  for (const d of Array.from(lunchDays).sort((a, b) => a - b)) {
    addTx(rows, new Date(year, m, d), 'Lunch', pick(LUNCH), -between(9, 22))
  }

  // ── Dinner (~3-4x/week = ~14/month) ─────────────────────────────────────
  const dinnerDays = new Set<number>()
  while (dinnerDays.size < between(12, 16, 0)) {
    dinnerDays.add(Math.floor(rand() * days) + 1)
  }
  for (const d of Array.from(dinnerDays).sort((a, b) => a - b)) {
    addTx(rows, new Date(year, m, d), 'Restaurant dinner', pick(DINNER), -between(22, 85))
  }

  // ── Fast food (~4x/week = ~17/month) ────────────────────────────────────
  const fastDays = new Set<number>()
  while (fastDays.size < between(15, 20, 0)) {
    fastDays.add(Math.floor(rand() * days) + 1)
  }
  for (const d of Array.from(fastDays).sort((a, b) => a - b)) {
    addTx(rows, new Date(year, m, d), 'Fast food', pick(FAST), -between(8, 28))
  }

  // ── Gas (2-3x/month) ────────────────────────────────────────────────────
  for (let i = 0; i < between(2, 4, 0); i++) {
    const d = Math.floor(rand() * days) + 1
    addTx(rows, new Date(year, m, d), 'Gas station', pick(GAS), -between(38, 82))
  }

  // ── Rideshare (~4x/week = ~16/month) ────────────────────────────────────
  const rideDays: number[] = []
  for (let i = 0; i < between(14, 18, 0); i++) rideDays.push(Math.floor(rand() * days) + 1)
  rideDays.sort((a, b) => a - b)
  for (const d of rideDays) {
    addTx(rows, new Date(year, m, d), 'Rideshare trip', pick(RIDE), -between(9, 42))
  }

  // ── Online/retail shopping (~17/month) ──────────────────────────────────
  for (let i = 0; i < between(15, 20, 0); i++) {
    const d = Math.floor(rand() * days) + 1
    const merchant = pick(SHOPPING)
    addTx(rows, new Date(year, m, d), 'Online/retail purchase', merchant, -between(12, 220))
  }

  // ── Pharmacy (~2-3/month) ────────────────────────────────────────────────
  for (let i = 0; i < between(2, 4, 0); i++) {
    const d = Math.floor(rand() * days) + 1
    addTx(rows, new Date(year, m, d), 'Pharmacy', pick(PHARMACY), -between(12, 68))
  }

  // ── Healthcare (0-2/month) ───────────────────────────────────────────────
  if (rand() > 0.4) {
    const d = Math.floor(rand() * days) + 1
    addTx(rows, new Date(year, m, d), 'Medical/dental', pick(HEALTH), -between(25, 320))
  }

  // ── Bars / drinks (~5/month) ─────────────────────────────────────────────
  for (let i = 0; i < between(4, 7, 0); i++) {
    const d = Math.floor(rand() * days) + 1
    addTx(rows, new Date(year, m, d), 'Bar / drinks', pick(BARS), -between(12, 65))
  }

  // ── Home supplies (~4/month) ─────────────────────────────────────────────
  for (let i = 0; i < between(3, 5, 0); i++) {
    const d = Math.floor(rand() * days) + 1
    addTx(rows, new Date(year, m, d), 'Home supplies', pick(HOME), -between(15, 120))
  }

  // ── Clothing (~3/month) ──────────────────────────────────────────────────
  for (let i = 0; i < between(2, 4, 0); i++) {
    const d = Math.floor(rand() * days) + 1
    addTx(rows, new Date(year, m, d), 'Clothing', pick(CLOTHING), -between(20, 180))
  }

  // ── Insurance (~2/month) ─────────────────────────────────────────────────
  if (m % 2 === 0) {
    addTx(rows, new Date(year, m, 10), 'Insurance payment', pick(INSURANCE), -between(85, 220))
    addTx(rows, new Date(year, m, 11), 'Insurance payment', pick(INSURANCE), -between(40, 110))
  }

  // ── Entertainment (3-5/month) ────────────────────────────────────────────
  for (let i = 0; i < between(3, 5, 0); i++) {
    const d = Math.floor(rand() * days) + 1
    addTx(rows, new Date(year, m, d), 'Entertainment', pick(ENTERTAIN), -between(15, 65))
  }

  // ── Pet (1-2/month, ~50% chance) ────────────────────────────────────────
  if (rand() > 0.5) {
    const d = Math.floor(rand() * days) + 1
    addTx(rows, new Date(year, m, d), 'Pet supplies', pick(PET), -between(20, 150))
  }

  // ── Travel (1-2x per quarter) ────────────────────────────────────────────
  if (m % 3 === 1) {
    for (let i = 0; i < between(2, 4, 0); i++) {
      const d = Math.floor(rand() * days) + 1
      addTx(rows, new Date(year, m, d), 'Travel expense', pick(TRAVEL), -between(80, 850))
    }
  }

  // ── Bank fees / ATM (~2/month) ────────────────────────────────────────────
  for (let i = 0; i < between(1, 3, 0); i++) {
    const d = Math.floor(rand() * days) + 1
    addTx(rows, new Date(year, m, d), 'Bank/ATM', pick(BANK), -between(2, 35))
  }

  // ── Misc (~10/month) ─────────────────────────────────────────────────────
  for (let i = 0; i < between(8, 12, 0); i++) {
    const d = Math.floor(rand() * days) + 1
    addTx(rows, new Date(year, m, d), 'Miscellaneous', pick(MISC), -between(2, 45))
  }
}

// Sort by date
rows.sort((a, b) => a.date.localeCompare(b.date))

// Write CSV
const header = 'Date,Description,Merchant,Amount'
const lines = rows.map(r => `${r.date},${r.description},${r.merchant},${r.amount.toFixed(2)}`)
const csv = [header, ...lines].join('\n') + '\n'

const outPath = join(__dirname, '../test-data/statements/1234_checking_demo-bank_large.csv')
writeFileSync(outPath, csv, 'utf-8')

// Stats
const byMonth: Record<string, number> = {}
for (const r of rows) {
  const key = r.date.slice(0, 7)
  byMonth[key] = (byMonth[key] || 0) + 1
}
console.log(`Generated ${rows.length} transactions`)
for (const [k, v] of Object.entries(byMonth).sort()) {
  console.log(`  ${k}: ${v} transactions`)
}
console.log(`Written to ${outPath}`)
