import { test, expect } from '../fixtures'

test.describe('Settings page', () => {
  test('shows API Keys card with expected labels', async ({ window: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Settings', exact: true }).click()
    await expect(w.getByRole('heading', { name: 'Settings' })).toBeVisible()

    await expect(w.getByText('API Keys', { exact: true })).toBeVisible()
    await expect(w.getByText('OpenAI API Key', { exact: true })).toBeVisible()
    await expect(w.getByText('Anthropic API Key', { exact: true })).toBeVisible()
  })

  test('API key inputs accept text', async ({ window: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Settings', exact: true }).click()

    const inputs = w.locator('input[placeholder="sk-ant-..."]')
    await inputs.fill('sk-ant-test-key')
    await expect(inputs).toHaveValue('sk-ant-test-key')
  })

  test('Data Management section is visible', async ({ window: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Settings', exact: true }).click()

    await expect(w.getByText('Data Management')).toBeVisible()
    await expect(w.getByRole('button', { name: 'Clear all data' })).toBeVisible()
  })

  test('Clear all data shows inline confirmation', async ({ seededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Settings', exact: true }).click()

    await w.getByRole('button', { name: 'Clear all data' }).click()

    // Inline confirmation should appear (no window.confirm)
    await expect(w.getByText('This will permanently delete everything. Are you sure?')).toBeVisible()
    await expect(w.getByRole('button', { name: 'Yes, delete everything' })).toBeVisible()
    await expect(w.getByRole('button', { name: 'Cancel' })).toBeVisible()
  })

  test('Cancel hides the confirmation', async ({ seededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Settings', exact: true }).click()

    await w.getByRole('button', { name: 'Clear all data' }).click()
    await w.getByText('This will permanently delete everything. Are you sure?').waitFor()

    await w.getByRole('button', { name: 'Cancel' }).click()

    await expect(
      w.getByText('This will permanently delete everything. Are you sure?')
    ).not.toBeVisible()
    await expect(w.getByRole('button', { name: 'Clear all data' })).toBeVisible()
  })

  test('About card shows app version', async ({ window: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Settings', exact: true }).click()

    await expect(w.getByText('Genzeb v1.0.0')).toBeVisible()
  })
})
