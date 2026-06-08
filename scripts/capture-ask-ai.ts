/**
 * Captures an Ask AI screenshot with a mocked LLM response.
 * Run from app/ dir:
 *   NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/capture-ask-ai.ts
 */
import { _electron as electron } from 'playwright'
import * as path from 'path'
import * as fs from 'fs'

const OUT_DIR = path.resolve(__dirname, '../docs/screenshots')

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

const MOCK_ANSWER = `Based on your transactions, here's a breakdown of food spending last month:

| Category | Amount |
|---|---|
| Groceries | $487.32 |
| Restaurants | $213.60 |
| Coffee shops | $54.80 |
| **Total food** | **$755.72** |

Your grocery spend was up **12%** compared to the previous month, while restaurant spending was down **8%**. The biggest single food transaction was $142.50 at Whole Foods on the 14th.`

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  // Inject a fake Anthropic key so the app enables the input
  const settingsPath = '/root/.config/Electron/settings.json'
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'))
  settings.anthropicKey = 'sk-ant-fake-key-for-screenshot'
  fs.writeFileSync(settingsPath, JSON.stringify(settings))

  const appPath = path.resolve(__dirname, '../app')
  const app = await electron.launch({
    executablePath: path.resolve(appPath, 'node_modules/.bin/electron'),
    args: [path.resolve(appPath, 'out/main/index.js')],
    env: { ...process.env, NODE_ENV: 'production', DISPLAY: process.env.DISPLAY || ':99' },
  })

  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await sleep(3000)

  // Navigate to Ask AI
  await page.locator('text="Ask AI"').first().click()
  await sleep(1500)

  // Mock the IPC calls so no real API request is made (string form avoids esbuild __name helpers)
  await page.evaluate(`
    window.api.askLlm = () => Promise.resolve(${JSON.stringify(MOCK_ANSWER)});
    window.api.exportForLlm = () => Promise.resolve(
      'id,date,merchant,amount,category\\n' +
      '1,2026-05-14,Whole Foods,-142.50,Groceries\\n' +
      '2,2026-05-21,Trader Joes,-98.40,Groceries\\n' +
      '3,2026-05-08,Chipotle,-18.75,Restaurants\\n'
    );
  `)

  // Click the "How much did I spend on food last month?" suggestion chip
  await page.locator('text="How much did I spend on food last month?"').first().click()
  await sleep(2500) // wait for mock response to render

  await page.screenshot({ path: path.join(OUT_DIR, '11-ask-ai-response.png') })
  console.log('✓ 11-ask-ai-response.png')

  await app.close()

  // Remove the fake key from settings
  delete settings.anthropicKey
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
  console.log('Cleaned up fake API key from settings.')
}

main().catch((err) => { console.error(err); process.exit(1) })
