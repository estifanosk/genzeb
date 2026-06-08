/**
 * Captures screenshots of each Genzeb page using Playwright + Electron.
 * Run from app/ dir:
 *   NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/capture-screenshots.ts
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

  console.log('Launching Electron…')
  const app = await electron.launch({
    executablePath: electronBin,
    args: [mainEntry],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DISPLAY: process.env.DISPLAY || ':99',
    },
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await sleep(3000) // let the app fully render

  async function nav(navId: string) {
    // Click sidebar nav item by its data or text
    const btn = page.locator(`[data-nav="${navId}"], nav button:has-text("${capitalize(navId)}")`)
    const count = await btn.count()
    if (count > 0) {
      await btn.first().click()
    } else {
      // fallback: look for any button/link containing the label
      const labels: Record<string, string> = {
        dashboard: 'Dashboard',
        transactions: 'Transactions',
        receipts: 'Receipts',
        items: 'Item Explorer',
        import: 'Import',
        reconcile: 'Reconcile',
        ask: 'Ask AI',
        settings: 'Settings',
      }
      await page.locator(`text="${labels[navId]}"`).first().click()
    }
    await sleep(1500)
  }

  function capitalize(s: string) {
    return s.charAt(0).toUpperCase() + s.slice(1)
  }

  async function shot(filename: string) {
    const dest = path.join(OUT_DIR, filename)
    await page.screenshot({ path: dest, fullPage: false })
    console.log(`  ✓ ${filename}`)
  }

  console.log('Capturing screenshots…')

  // Dashboard
  await nav('dashboard')
  await shot('01-dashboard.png')

  // Transactions
  await nav('transactions')
  await sleep(500)
  await shot('02-transactions.png')

  // Open one transaction row to show receipt expansion
  const firstRow = page.locator('table tbody tr, [role="row"]').nth(1)
  if (await firstRow.count() > 0) {
    await firstRow.click()
    await sleep(800)
    await shot('03-transactions-detail.png')
    // close / escape
    await page.keyboard.press('Escape')
    await sleep(400)
  }

  // Receipts
  await nav('receipts')
  await sleep(500)
  await shot('04-receipts.png')

  // Click first receipt to open detail
  const firstReceipt = page.locator('[data-receipt-item], .receipt-card, [data-testid="receipt-item"]').first()
  if (await firstReceipt.count() > 0) {
    await firstReceipt.click()
    await sleep(800)
    await shot('05-receipts-detail.png')
    await page.keyboard.press('Escape')
    await sleep(400)
  }

  // Item Explorer
  await nav('items')
  await sleep(500)
  await shot('06-item-explorer.png')

  // Import — statements tab
  await nav('import')
  await sleep(500)
  await shot('07-import.png')

  // Try clicking Receipts tab in Import
  const importReceiptsTab = page.locator('text="Receipts"').nth(1)
  if (await importReceiptsTab.count() > 0) {
    await importReceiptsTab.click()
    await sleep(500)
    await shot('08-import-receipts.png')
  }

  // History tab
  const historyTab = page.locator('text="History"')
  if (await historyTab.count() > 0) {
    await historyTab.click()
    await sleep(500)
    await shot('09-import-history.png')
  }

  // Reconcile
  await nav('reconcile')
  await sleep(800)
  await shot('10-reconcile.png')

  // Ask AI
  await nav('ask')
  await sleep(500)
  await shot('11-ask-ai.png')

  // Settings
  await nav('settings')
  await sleep(500)
  await shot('12-settings.png')

  await app.close()
  console.log(`\nDone — screenshots saved to ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
