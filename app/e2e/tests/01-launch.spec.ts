import { test, expect } from '../fixtures'

test.describe('App launch', () => {
  test('renders sidebar and default Transactions page', async ({ window }) => {
    await expect(window.locator('nav')).toBeVisible()
    await expect(window.getByRole('heading', { name: 'Transactions' })).toBeVisible()
  })

  test('shows empty state with Import CTA when no data', async ({ window }) => {
    await expect(window.getByText('No transactions yet')).toBeVisible()
    await expect(window.getByRole('button', { name: 'Import a statement' })).toBeVisible()
  })

  test('sidebar has all expected nav items', async ({ window }) => {
    const nav = window.locator('nav')
    await expect(nav.getByRole('button', { name: 'Transactions' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Receipts' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Item Explorer' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Import' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Reconcile' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Ask AI' })).toBeVisible()
    await expect(nav.getByRole('button', { name: 'Settings' })).toBeVisible()
  })

  test('theme toggle button is visible', async ({ window }) => {
    await expect(window.getByLabel('Toggle theme')).toBeVisible()
  })
})
