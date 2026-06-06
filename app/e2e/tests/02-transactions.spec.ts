import { test, expect } from '../fixtures'

test.describe('Transactions page (seeded data)', () => {
  test.beforeEach(async ({ seededWindow }) => {
    await seededWindow.getByRole('button', { name: 'Transactions' }).click()
  })

  test('shows 6 transaction rows after seeding', async ({ seededWindow }) => {
    await expect(seededWindow.getByText('6 records')).toBeVisible()
  })

  test('amounts are formatted with $ prefix', async ({ seededWindow }) => {
    await seededWindow.getByText('6 records').waitFor()
    const amounts = seededWindow.locator('.text-red-400, .text-green-400')
    await expect(amounts.first()).toBeVisible()
    const text = await amounts.first().innerText()
    // Negative amounts render as "-$46.12", positive as "$10.00"
    expect(text).toMatch(/\$/)
  })

  test('filter by date range with no results shows empty state', async ({ seededWindow }) => {
    await seededWindow.getByText('6 records').waitFor()

    await seededWindow.getByRole('button', { name: /Filters/ }).click()

    // Use a date range well in the future — guaranteed no matches
    const dateInputs = seededWindow.locator('input[type="date"]')
    await dateInputs.first().fill('2099-01-01')
    await dateInputs.nth(1).fill('2099-01-31')

    await expect(seededWindow.getByText('No transactions', { exact: true })).toBeVisible()
  })

  test('footer shows total amount', async ({ seededWindow }) => {
    await seededWindow.getByText('6 records').waitFor()
    // Footer total — amount formatted with $
    const footer = seededWindow.locator('text=/\\$/')
    await expect(footer.first()).toBeVisible()
  })
})
