import { test, expect } from '@playwright/test'

test('home loads without console errors and shows the shell on an empty DB', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))

  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(errors).toEqual([])
})
