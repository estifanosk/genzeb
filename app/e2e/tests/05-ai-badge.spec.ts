import { test, expect } from '../fixtures'

test.describe('AI badge on agent-edited transactions', () => {
  test('shows AI badge on a transaction with an agent change', async ({ agentSeededWindow: w }) => {
    await w.getByRole('button', { name: 'Transactions' }).click()
    await w.getByText('6 records').waitFor({ timeout: 10_000 })

    // The badge is a <span> with exactly "AI" — distinct from the "Ask AI" nav button
    await expect(w.locator('span', { hasText: /^AI$/ }).first()).toBeVisible()
  })

  test('AI badge is not shown on transactions without agent changes', async ({ seededWindow: w }) => {
    await w.getByRole('button', { name: 'Transactions' }).click()
    await w.getByText('6 records').waitFor({ timeout: 10_000 })

    // No agent changes were seeded — badge spans must not appear
    await expect(w.locator('span', { hasText: /^AI$/ }).first()).not.toBeVisible()
  })
})
