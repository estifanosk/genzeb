/**
 * Captures detail screenshots with DOM inspection.
 */
import { _electron as electron } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

const OUT_DIR = path.resolve(__dirname, '../docs/screenshots')

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
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
    await sleep(1500)
  }

  // --- Transactions ---
  await clickText('Transactions')
  await sleep(1500)

  // Inspect DOM
  const txInfo = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('div[class]')
    const classNames = new Set<string>()
    allDivs.forEach(d => {
      d.className.split(' ').forEach(c => { if (c.includes('row') || c.includes('Row')) classNames.add(c) })
    })
    const scrollContainers = Array.from(document.querySelectorAll('[data-virtuoso-scroller]')).length
    const dataRows = document.querySelectorAll('[data-index]').length
    const tableRows = document.querySelectorAll('[role="row"]').length
    const clickable = Array.from(document.querySelectorAll('[class*="cursor-pointer"]')).slice(0, 5).map(e => ({
      tag: e.tagName,
      cls: (e as HTMLElement).className.slice(0, 60)
    }))
    return { classNames: Array.from(classNames).slice(0, 20), scrollContainers, dataRows, tableRows, clickable }
  })
  console.log('Tx info:', JSON.stringify(txInfo, null, 2))

  // Try data-index rows
  const dataIndexRows = page.locator('[data-index]')
  const dataIndexCount = await dataIndexRows.count()
  console.log('data-index rows:', dataIndexCount)

  if (dataIndexCount > 0) {
    await dataIndexRows.first().click()
    await sleep(1000)
    await shot('03-transactions-detail.png')
    await page.keyboard.press('Escape')
    await sleep(500)
  } else {
    // Try cursor-pointer elements in main area
    const pointers = page.locator('main [class*="cursor-pointer"], [class*="cursor-pointer"]')
    const pCount = await pointers.count()
    console.log('cursor-pointer count:', pCount)
    if (pCount > 0) {
      await pointers.first().click()
      await sleep(1000)
      await shot('03-transactions-detail.png')
      await page.keyboard.press('Escape')
      await sleep(500)
    }
  }

  // --- Receipts: click first receipt thumbnail ---
  await clickText('Receipts')
  await sleep(1000)

  const imgs = page.locator('img')
  const imgCount = await imgs.count()
  console.log('Receipt imgs:', imgCount)

  if (imgCount > 0) {
    // Click the first receipt image's parent (the card/button)
    await imgs.first().click()
    await sleep(1200)
    await shot('05-receipts-detail.png')
    await page.keyboard.press('Escape')
    await sleep(500)
  }

  await app.close()
  console.log('\nDone')
}

main().catch((err) => { console.error(err); process.exit(1) })
