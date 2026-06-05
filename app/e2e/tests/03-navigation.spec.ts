import { test, expect } from '../fixtures'

const PAGES = [
  { nav: 'Receipts',      heading: 'Receipts' },
  { nav: 'Item Explorer', heading: 'Item Explorer' },
  { nav: 'Import',        heading: 'Import' },
  { nav: 'Reconcile',     heading: 'Reconcile' },
  { nav: 'Ask AI',        heading: 'Ask AI' },
  { nav: 'Settings',      heading: 'Settings' },
]

test.describe('Sidebar navigation', () => {
  for (const { nav, heading } of PAGES) {
    test(`navigates to ${nav}`, async ({ window }) => {
      await window.locator('nav').getByRole('button', { name: nav, exact: true }).click()
      await expect(window.getByRole('heading', { name: heading })).toBeVisible()
    })
  }

  test('returns to Transactions page', async ({ window }) => {
    const nav = window.locator('nav')
    await nav.getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(window.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await nav.getByRole('button', { name: 'Transactions', exact: true }).click()
    await expect(window.getByRole('heading', { name: 'Transactions' })).toBeVisible()
  })

  test('Receipts empty state has Import CTA', async ({ window }) => {
    await window.getByRole('button', { name: 'Receipts' }).click()
    await expect(window.getByRole('button', { name: 'Import a receipt' })).toBeVisible()
  })

  test('Reconcile empty state has Import CTA', async ({ window }) => {
    await window.getByRole('button', { name: 'Reconcile' }).click()
    await expect(window.getByRole('button', { name: 'Import a receipt' })).toBeVisible()
  })
})
