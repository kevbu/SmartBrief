import { test, expect, type Page } from '@playwright/test'

test.use({ colorScheme: 'dark' })

const html = (page: Page) => page.locator('html')
const themeColor = (page: Page) =>
  page.locator('meta[name="theme-color"]').first().getAttribute('content')

const LIGHT = '#f7f6f2'
const DARK = '#0e0e11'

async function choose(page: Page, label: 'System' | 'Light' | 'Dark') {
  await page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: label }).click()
}

test.describe('theme override', () => {
  test('System follows the emulated OS dark scheme by default', async ({ page }) => {
    await page.goto('/settings')
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    expect(await themeColor(page)).toBe(DARK)
  })

  test('choosing Light applies immediately and updates theme-color', async ({ page }) => {
    await page.goto('/settings')
    await choose(page, 'Light')
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
    expect(await themeColor(page)).toBe(LIGHT)
    await expect(
      page.getByRole('group', { name: 'Theme' }).getByRole('button', { name: 'Light' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  test('Light survives reload with no dark flash', async ({ page }) => {
    await page.goto('/settings')
    await choose(page, 'Light')

    // Record every data-theme value from the first parsed element onwards.
    await page.addInitScript(() => {
      const seen: string[] = []
      ;(window as unknown as { __themes: string[] }).__themes = seen
      const record = () => {
        const t = document.documentElement.getAttribute('data-theme')
        if (t && seen[seen.length - 1] !== t) seen.push(t)
      }
      new MutationObserver(record).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme'],
      })
      record()
    })

    await page.reload({ waitUntil: 'commit' })
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
    await page.waitForLoadState('load')

    const seen = await page.evaluate(() => (window as unknown as { __themes: string[] }).__themes)
    expect(seen).not.toContain('dark')
    expect(await themeColor(page)).toBe(LIGHT)
  })

  test('System follows the emulated scheme again, live', async ({ page }) => {
    await page.goto('/settings')
    await choose(page, 'Light')
    await expect(html(page)).toHaveAttribute('data-theme', 'light')

    await choose(page, 'System')
    await expect(html(page)).toHaveAttribute('data-theme', 'dark')
    expect(await themeColor(page)).toBe(DARK)

    await page.emulateMedia({ colorScheme: 'light' })
    await expect(html(page)).toHaveAttribute('data-theme', 'light')
    expect(await themeColor(page)).toBe(LIGHT)
  })
})
