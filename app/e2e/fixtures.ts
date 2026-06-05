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

/** Seed a data folder with 6 demo transactions using the demo CSV fixture. */
export function seedDataFolder(dir: string): void {
  execSync(
    [
      `NODE_PATH=${APP_DIR}/node_modules`,
      `npx tsx --tsconfig ${APP_DIR}/tsconfig.node.json`,
      `${join(__dirname, 'seed.ts')} ${dir}`,
    ].join(' '),
    { cwd: APP_DIR, stdio: 'pipe' }
  )
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
})

export { expect }
