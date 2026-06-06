import { test, expect } from '../fixtures'

const DEMO_FILENAME = '1234_checking_demo-bank_2026-05.csv'

/** Navigate to Import and wait for the inbox scan to reveal the demo file. */
async function goToImportAndWaitForFile(w: import('playwright-core').Page) {
  await w.locator('nav').getByRole('button', { name: 'Import', exact: true }).click()
  await expect(w.getByRole('heading', { name: 'Import' })).toBeVisible()
  // Wait for the inbox scan to place the file in the list
  await w.getByText(DEMO_FILENAME).waitFor({ timeout: 12_000 })
}

/** Run the full select → preview → import flow and return on the summary screen. */
async function runFullImport(w: import('playwright-core').Page) {
  await goToImportAndWaitForFile(w)
  await w.getByRole('radio').first().click()
  await w.getByRole('button', { name: 'Next' }).click()
  // Preview card shows "Preview: <filename>"
  await w.getByText(DEMO_FILENAME).waitFor({ timeout: 10_000 })
  // Use tabpanel scope to avoid matching the nav "Import" sidebar button
  await w.getByRole('tabpanel').getByRole('button', { name: 'Import' }).click()
  await w.getByText('Import Summary').waitFor({ timeout: 15_000 })
}

test.describe('Import via UI', () => {
  test('selects a file, previews, imports, and shows summary', async ({ inboxReadyWindow: w }) => {
    await runFullImport(w)
    await expect(w.getByText('Imported rows: 6')).toBeVisible()
  })

  test('Import Another button returns to select step', async ({ inboxReadyWindow: w }) => {
    await runFullImport(w)
    await w.getByRole('button', { name: 'Import Another' }).click()
    await expect(w.getByText('Pending files')).toBeVisible()
  })

  test('History tab shows the imported file', async ({ inboxReadyWindow: w }) => {
    await runFullImport(w)
    await w.getByRole('tab', { name: 'History' }).click()
    // History table should show the file that was just imported
    await expect(w.getByText(DEMO_FILENAME)).toBeVisible({ timeout: 8_000 })
  })
})
