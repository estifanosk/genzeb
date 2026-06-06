import { test, expect } from '../fixtures'

test.describe('Reconcile flow', () => {
  test('shows unlinked receipt count', async ({ receiptSeededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Reconcile', exact: true }).click()
    await expect(w.getByRole('heading', { name: 'Reconcile' })).toBeVisible()

    // Should show 1 unlinked
    await expect(w.getByText('1 unlinked')).toBeVisible({ timeout: 10_000 })
    await expect(w.getByText('0 linked')).toBeVisible()
  })

  test('selecting a receipt shows match candidates', async ({ receiptSeededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Reconcile', exact: true }).click()
    await w.getByText('1 unlinked').waitFor({ timeout: 10_000 })

    // Click the Harbor Table receipt in the left panel
    await w.getByRole('button', { name: /Harbor Table/i }).click()

    // Candidate list should appear (our seeded transaction matches)
    await expect(w.getByText(/Harbor Table/i).nth(1)).toBeVisible({ timeout: 8_000 })
    await expect(w.getByRole('button', { name: 'Link' })).toBeVisible()
  })

  test('linking a receipt moves it to the linked section', async ({ receiptSeededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Reconcile', exact: true }).click()
    await w.getByText('1 unlinked').waitFor({ timeout: 10_000 })

    await w.getByRole('button', { name: /Harbor Table/i }).click()
    await w.getByRole('button', { name: 'Link' }).first().click()

    // After linking: 0 unlinked, 1 linked
    await expect(w.getByText('0 unlinked')).toBeVisible({ timeout: 10_000 })
    await expect(w.getByText('1 linked')).toBeVisible()
  })

  test('linked receipt can be unlinked', async ({ receiptSeededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Reconcile', exact: true }).click()
    await w.getByText('1 unlinked').waitFor({ timeout: 10_000 })

    // Link it first
    await w.getByRole('button', { name: /Harbor Table/i }).click()
    await w.getByRole('button', { name: 'Link' }).first().click()
    await w.getByText('1 linked').waitFor({ timeout: 10_000 })

    // Click the linked receipt to select it, then unlink
    const linkedSection = w.locator('button', { hasText: /Harbor Table/i })
    await linkedSection.click()
    await w.getByRole('button', { name: 'Unlink' }).click()

    // Should go back to 1 unlinked
    await expect(w.getByText('1 unlinked')).toBeVisible({ timeout: 10_000 })
    await expect(w.getByText('0 linked')).toBeVisible()
  })
})
