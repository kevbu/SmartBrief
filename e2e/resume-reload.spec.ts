import { test, expect, type Page } from '@playwright/test'

// A resumed PWA must pick up a refresh the server ran while it was in the
// background, and must leave the feed alone when nothing is new.

async function loadHome(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
  await page.waitForLoadState('networkidle')
}

function countNewsReads(page: Page) {
  const seen = { count: 0 }
  page.on('request', (req) => {
    if (new URL(req.url()).pathname === '/api/news') seen.count++
  })
  return seen
}

async function resume(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
}

test('reloads the feed on resume when the server refreshed meanwhile', async ({ page }) => {
  await loadHome(page)
  const reads = countNewsReads(page)
  await page.route('**/api/news/status', (route) =>
    route.fulfill({ json: { lastRefreshed: new Date(Date.now() + 60_000).toISOString() } })
  )

  const newsRead = page.waitForRequest((req) => new URL(req.url()).pathname === '/api/news')
  await resume(page)
  await newsRead
  expect(reads.count).toBe(1)
})

test('leaves the feed alone on resume when the server has nothing new', async ({ page }) => {
  await loadHome(page)
  const reads = countNewsReads(page)
  await page.route('**/api/news/status', (route) => route.fulfill({ json: { lastRefreshed: null } }))

  const probe = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/news/status')
  await resume(page)
  await probe
  await page.waitForLoadState('networkidle')
  expect(reads.count).toBe(0)
})

test('status endpoint answers without caching', async ({ request }) => {
  const res = await request.get('/api/news/status')
  expect(res.ok()).toBe(true)
  expect(res.headers()['cache-control']).toContain('no-store')
  expect(await res.json()).toHaveProperty('lastRefreshed')
})
