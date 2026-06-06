import { test, expect } from '../fixtures'

test.describe('AI badge on agent-edited transactions', () => {
  test('shows AI badge on a transaction with an agent change', async ({ agentSeededWindow: w }) => {
    // Transactions page is default — wait for rows to load
    await w.getByText('Showing 1–6 of 6').waitFor({ timeout: 10_000 })

    // The badge is a <span> with exactly "AI" — distinct from the "Ask AI" nav button
    await expect(w.locator('span', { hasText: /^AI$/ }).first()).toBeVisible()
  })

  test('AI badge is not shown on transactions without agent changes', async ({ seededWindow: w }) => {
    await w.getByText('Showing 1–6 of 6').waitFor({ timeout: 10_000 })

    // No agent changes were seeded — badge spans must not appear
    await expect(w.locator('span', { hasText: /^AI$/ }).first()).not.toBeVisible()
  })
})
