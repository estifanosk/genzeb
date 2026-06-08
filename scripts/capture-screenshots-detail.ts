/**
 * Captures detail-view screenshots (transaction row expansion, receipt viewer).
 * Run from app/ dir:
 *   NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/capture-screenshots-detail.ts
 */
import { _electron as electron } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

const OUT_DIR = path.resolve(__dirname, '../docs/screenshots')

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const appPath = path.resolve(__dirname, '../app')
  const electronBin = path.resolve(appPath, 'node_modules/.bin/electron')
  const mainEntry = path.resolve(appPath, 'out/main/index.js')

  const app = await electron.launch({
    executablePath: electronBin,
    args: [mainEntry],
    env: { ...process.env, NODE_ENV: 'production', DISPLAY: process.env.DISPLAY || ':99' },
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await sleep(3000)

  async function shot(filename: string) {
    const dest = path.join(OUT_DIR, filename)
    await page.screenshot({ path: dest, fullPage: false })
    console.log(`  ✓ ${filename}`)
  }

  async function clickText(text: string) {
    await page.locator(`text="${text}"`).first().click()
    await sleep(1200)
  }

  // --- Transactions: expand a row ---
  await clickText('Transactions')
  await sleep(1000)

  // Dump what row-level elements exist
  const rowInfo = await page.evaluate(() => {
    const rows = document.querySelectorAll('tr')
    const divRows = document.querySelectorAll('[role="row"]')
    return { trCount: rows.length, divRowCount: divRows.length }
  })
  console.log('Row info:', rowInfo)

  // Try clicking the second <tr> (first is header)
  const trs = page.locator('tr')
  const trCount = await trs.count()
  console.log('tr count:', trCount)
  if (trCount > 1) {
    await trs.nth(1).click()
    await sleep(1000)
    await shot('03-transactions-detail.png')
    await page.keyboard.press('Escape')
    await sleep(500)
  }

  // --- Receipts: open viewer ---
  await clickText('Receipts')
  await sleep(1000)

  // Dump receipt-related elements
  const receiptInfo = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img')
    const cards = document.querySelectorAll('[class*="card"], [class*="receipt"], [class*="thumb"]')
    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent?.trim()).slice(0, 20)
    return { imgCount: imgs.length, cardCount: cards.length, buttons }
  })
  console.log('Receipt info:', JSON.stringify(receiptInfo, null, 2))

  // Try clicking first image or any clickable receipt card
  const imgs = page.locator('img')
  const imgCount = await imgs.count()
  console.log('img count:', imgCount)
  if (imgCount > 0) {
    await imgs.first().click()
    await sleep(1000)
    await shot('05-receipts-detail.png')
    await page.keyboard.press('Escape')
    await sleep(500)
  } else {
    // Try clicking any list item
    const listItems = page.locator('li, [role="listitem"]')
    if (await listItems.count() > 0) {
      await listItems.first().click()
      await sleep(1000)
      await shot('05-receipts-detail.png')
      await page.keyboard.press('Escape')
      await sleep(500)
    }
  }

  await app.close()
  console.log(`\nDone`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
