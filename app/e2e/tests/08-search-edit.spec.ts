import { test, expect } from '../fixtures'

test.describe('Transaction search filter', () => {
  test('search narrows results to matching merchant', async ({ seededWindow: w }) => {
    await w.getByText('Showing 1–6 of 6').waitFor()
    await w.getByPlaceholder('Search transactions...').fill('acme')
    await expect(w.getByText('Showing 1–1 of 1')).toBeVisible({ timeout: 8_000 })
  })

  test('clearing search restores full list', async ({ seededWindow: w }) => {
    await w.getByText('Showing 1–6 of 6').waitFor()
    await w.getByPlaceholder('Search transactions...').fill('acme')
    await w.getByText('Showing 1–1 of 1').waitFor({ timeout: 8_000 })
    await w.getByPlaceholder('Search transactions...').fill('')
    await expect(w.getByText('Showing 1–6 of 6')).toBeVisible({ timeout: 8_000 })
  })
})

test.describe('Transaction inline edit', () => {
  test('edit button opens inputs and saves category change', async ({ seededWindow: w }) => {
    await w.getByText('Showing 1–6 of 6').waitFor()

    // Narrow to one row so we have a stable target
    await w.getByPlaceholder('Search transactions...').fill('acme')
    await w.getByText('Showing 1–1 of 1').waitFor({ timeout: 8_000 })

    // Edit2 in v0.564 maps to the "pen" lucide icon
    const editBtn = w.locator('button:has(svg.lucide-pen)').first()
    await editBtn.click()

    // Category input appears (merchant is first, category is second text input)
    const inputs = w.locator('div.border-t input[type="text"]')
    await inputs.first().waitFor({ timeout: 5_000 })

    // Fill category (second visible text input after merchant)
    await inputs.nth(1).fill('Groceries')

    // Save with the Check button
    await w.locator('button:has(svg.lucide-check)').first().click()

    // Category value is now visible in the row
    await expect(w.getByText('Groceries')).toBeVisible({ timeout: 8_000 })
  })
})
