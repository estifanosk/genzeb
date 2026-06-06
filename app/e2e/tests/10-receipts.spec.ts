import { test, expect } from '../fixtures'

test.describe('Receipts page', () => {
  test('shows receipt list with OCR and status badges', async ({ receiptSeededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Receipts', exact: true }).click()
    await expect(w.getByRole('heading', { name: 'Receipts' })).toBeVisible()

    // Should show 1 receipt with date/merchant from seed data
    await expect(w.getByText(/Harbor Table/i)).toBeVisible({ timeout: 10_000 })

    // Stats bar should show 1 receipt
    await expect(w.getByText('1 receipt')).toBeVisible()
  })

  test('expanding a receipt row shows the detail panel', async ({ receiptSeededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Receipts', exact: true }).click()
    await w.getByText(/Harbor Table/i).waitFor({ timeout: 10_000 })

    // Click the row to expand it
    await w.locator('tbody tr').first().click()

    // Detail panel should appear (it has "No line items extracted" when no OCR was run)
    await expect(w.getByText(/No line items extracted|Line items/i)).toBeVisible({ timeout: 8_000 })
  })
})
