import { test, expect } from '../fixtures'

// E2E tests always run with a data folder set via E2E_DATA_FOLDER env var,
// so the "no data folder" empty state is not testable here.
test.describe('Ask AI page', () => {
  test('shows heading and API key prompt when no key is set', async ({ seededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Ask AI', exact: true }).click()
    await expect(w.getByRole('heading', { name: 'Ask AI' })).toBeVisible({ timeout: 8_000 })
    await expect(w.getByText(/Add an OpenAI or Anthropic API key/i)).toBeVisible()
  })

  test('question input is disabled without an API key', async ({ seededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Ask AI', exact: true }).click()
    await expect(w.getByText(/Add an OpenAI or Anthropic API key/i)).toBeVisible({ timeout: 8_000 })
    await expect(w.getByPlaceholder(/Add an API key in Settings/)).toBeDisabled()
  })

  test('Data scope section is visible', async ({ seededWindow: w }) => {
    await w.locator('nav').getByRole('button', { name: 'Ask AI', exact: true }).click()
    await expect(w.getByText(/Data scope/i)).toBeVisible({ timeout: 8_000 })
  })
})
