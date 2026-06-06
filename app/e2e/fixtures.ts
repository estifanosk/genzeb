import { test as base, expect } from '@playwright/test'
import { _electron as electron } from 'playwright-core'
import type { ElectronApplication, Page } from 'playwright-core'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

export const APP_DIR = join(__dirname, '..')

export const ELECTRON_BIN =
  process.platform === 'darwin'
    ? join(APP_DIR, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron')
    : join(APP_DIR, 'node_modules/electron/dist/electron')

function runSeedScript(script: string, dir: string): void {
  execSync(
    [
      `NODE_PATH=${APP_DIR}/node_modules`,
      `npx tsx --tsconfig ${APP_DIR}/tsconfig.node.json`,
      `${join(__dirname, script)} ${dir}`,
    ].join(' '),
    { cwd: APP_DIR, stdio: 'pipe' }
  )
}

/** Seed a data folder with 6 demo transactions using the demo CSV fixture. */
export function seedDataFolder(dir: string): void {
  runSeedScript('seed.ts', dir)
}

/** Seed transactions + one agent change (for AI-badge tests). */
export function seedAgentChange(dir: string): void {
  runSeedScript('seed-agent.ts', dir)
}

/** Seed transactions + one unlinked receipt (for reconcile tests). */
export function seedReceipt(dir: string): void {
  runSeedScript('seed-receipt.ts', dir)
}

/** Place the demo CSV in inbox/statements without importing (for import-via-UI tests). */
export function seedInbox(dir: string): void {
  runSeedScript('seed-inbox.ts', dir)
}

/** Launch the app against a specific data folder and wait for the UI to be ready. */
async function launchApp(dataFolder: string): Promise<{ app: ElectronApplication; window: Page }> {
  const app = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [APP_DIR],
    env: { ...process.env, E2E_DATA_FOLDER: dataFolder },
    timeout: 30_000,
  })
  const window = await app.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  // Wait for the sidebar nav to appear — signals React has mounted
  await window.waitForSelector('nav', { timeout: 20_000 })
  return { app, window }
}

type Fixtures = {
  /** Fresh empty data folder + running app */
  app: ElectronApplication
  window: Page
  /** Pre-seeded data folder (6 demo transactions) + running app */
  seededApp: ElectronApplication
  seededWindow: Page
  /** Data folder with 6 transactions + one agent change (AI badge visible) */
  agentSeededApp: ElectronApplication
  agentSeededWindow: Page
  /** Data folder with 6 transactions + one unlinked receipt (reconcile tests) */
  receiptSeededApp: ElectronApplication
  receiptSeededWindow: Page
  /** Data folder with inbox CSV but no imported transactions (import-via-UI tests) */
  inboxReadyApp: ElectronApplication
  inboxReadyWindow: Page
}

export const test = base.extend<Fixtures>({
  app: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'genzeb-e2e-'))
    const { app } = await launchApp(dir)
    await use(app)
    await app.close().catch(() => {})
    rmSync(dir, { recursive: true, force: true })
  },

  window: async ({ app }, use) => {
    const window = await app.firstWindow()
    await use(window)
  },

  seededApp: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'genzeb-e2e-'))
    seedDataFolder(dir)
    const { app } = await launchApp(dir)
    await use(app)
    await app.close().catch(() => {})
    rmSync(dir, { recursive: true, force: true })
  },

  seededWindow: async ({ seededApp }, use) => {
    const window = await seededApp.firstWindow()
    await use(window)
  },

  agentSeededApp: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'genzeb-e2e-'))
    seedAgentChange(dir)
    const { app } = await launchApp(dir)
    await use(app)
    await app.close().catch(() => {})
    rmSync(dir, { recursive: true, force: true })
  },

  agentSeededWindow: async ({ agentSeededApp }, use) => {
    const window = await agentSeededApp.firstWindow()
    await use(window)
  },

  receiptSeededApp: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'genzeb-e2e-'))
    seedReceipt(dir)
    const { app } = await launchApp(dir)
    await use(app)
    await app.close().catch(() => {})
    rmSync(dir, { recursive: true, force: true })
  },

  receiptSeededWindow: async ({ receiptSeededApp }, use) => {
    const window = await receiptSeededApp.firstWindow()
    await use(window)
  },

  inboxReadyApp: async ({}, use) => {
    const dir = mkdtempSync(join(tmpdir(), 'genzeb-e2e-'))
    seedInbox(dir)
    const { app } = await launchApp(dir)
    await use(app)
    await app.close().catch(() => {})
    rmSync(dir, { recursive: true, force: true })
  },

  inboxReadyWindow: async ({ inboxReadyApp }, use) => {
    const window = await inboxReadyApp.firstWindow()
    await use(window)
  },
})

export { expect }
