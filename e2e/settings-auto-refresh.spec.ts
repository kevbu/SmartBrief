import { test, expect, type Page } from '@playwright/test'

// Implements features/settings-auto-refresh.feature.
// The e2e server runs with SMARTBRIEF_SCHEDULER=off (playwright.config.ts), so saving
// a schedule never starts a real refresh. HP-4 writes the single preferences row, so
// this file runs serially and restores Manual afterwards.
test.describe.configure({ mode: 'serial' })

const INTERVALS = ['30 min', '1 hour', '2 hours', '4 hours', '6 hours'] as const
const CATCH_UP = 'If your computer is asleep then, it runs as soon as it wakes.'

const section = (page: Page) =>
  page.locator('section').filter({ has: page.getByRole('heading', { name: 'Auto-Refresh' }) })
const modeGroup = (page: Page) => page.getByRole('radiogroup', { name: 'Refresh mode' })
const mode = (page: Page, label: 'Manual' | 'Interval' | 'Daily') =>
  modeGroup(page).getByRole('radio', { name: label, exact: true })
const interval = (page: Page, label: string) =>
  section(page).getByRole('button', { name: label, exact: true })
const dailyTime = (page: Page) => section(page).getByLabel('Every day at')
const costHint = (page: Page) => section(page).getByText('Each refresh uses Claude.')

// Background: Given I am on the Settings page (with preferences loaded)
async function openSettings(page: Page) {
  const prefsLoaded = page.waitForResponse(
    (r) => r.url().includes('/api/preferences') && r.request().method() === 'GET',
  )
  await page.goto('/settings')
  await prefsLoaded
  await expect(modeGroup(page)).toBeVisible()
}

test.describe('settings auto-refresh', () => {
  test.afterAll(async ({ request }) => {
    // Leave the shared e2e DB in the default state for other files.
    const res = await request.put('/api/preferences', {
      data: { refreshMode: 'manual', refreshDailyTime: '07:00' },
    })
    expect(res.ok()).toBe(true)
  })

  // Scenario: HP-1 - Manual is the default and shows no schedule controls
  test('HP-1: Manual is the default and shows no schedule controls', async ({ page }) => {
    await openSettings(page)
    // Then the "Refresh mode" radiogroup offers "Manual", "Interval" and "Daily"
    await expect(modeGroup(page).getByRole('radio')).toHaveText(['Manual', 'Interval', 'Daily'])
    // And "Manual" is checked
    await expect(mode(page, 'Manual')).toHaveAttribute('aria-checked', 'true')
    await expect(mode(page, 'Interval')).toHaveAttribute('aria-checked', 'false')
    await expect(mode(page, 'Daily')).toHaveAttribute('aria-checked', 'false')
    // And the Auto-Refresh section says "Only when you tap refresh."
    await expect(section(page).getByText('Only when you tap refresh.')).toBeVisible()
    // And no interval options are visible
    for (const label of INTERVALS) await expect(interval(page, label)).toHaveCount(0)
    // And no "Every day at" time input is visible
    await expect(dailyTime(page)).toHaveCount(0)
    // And the hint "Each refresh uses Claude." is not shown
    await expect(costHint(page)).toHaveCount(0)
  })

  // Scenario Outline: HP-2 - Interval mode shows the interval options and the cost hint
  for (const option of INTERVALS) {
    test(`HP-2: Interval mode shows the interval options and the cost hint (${option})`, async ({ page }) => {
      await openSettings(page)
      // When I choose the "Interval" refresh mode
      await mode(page, 'Interval').click()
      // Then "Interval" is checked
      await expect(mode(page, 'Interval')).toHaveAttribute('aria-checked', 'true')
      await expect(mode(page, 'Manual')).toHaveAttribute('aria-checked', 'false')
      // And the interval options "30 min" ... "6 hours" are visible
      for (const label of INTERVALS) await expect(interval(page, label)).toBeVisible()
      // When I choose the interval "<option>"
      await interval(page, option).click()
      // Then "<option>" is pressed and no other interval option is pressed
      for (const label of INTERVALS) {
        await expect(interval(page, label)).toHaveAttribute(
          'aria-pressed',
          label === option ? 'true' : 'false',
        )
      }
      // And the Auto-Refresh section says "Every <phrase> while your computer is on."
      await expect(
        section(page).getByText(`Every ${option} while your computer is on.`, { exact: true }),
      ).toBeVisible()
      // And the hint "Each refresh uses Claude." is shown
      await expect(costHint(page)).toBeVisible()
    })
  }

  // Scenario: HP-3 - Daily mode shows a labelled time input prefilled with 07:00
  test('HP-3: Daily mode shows a labelled time input prefilled with 07:00', async ({ page }) => {
    await openSettings(page)
    // When I choose the "Daily" refresh mode
    await mode(page, 'Daily').click()
    // Then "Daily" is checked
    await expect(mode(page, 'Daily')).toHaveAttribute('aria-checked', 'true')
    // And a time input labelled "Every day at" shows "07:00"
    await expect(dailyTime(page)).toHaveAttribute('type', 'time')
    await expect(dailyTime(page)).toHaveValue('07:00')
    // And the Auto-Refresh section says "Every day at 07:00. ..."
    await expect(section(page).getByText(`Every day at 07:00. ${CATCH_UP}`, { exact: true })).toBeVisible()
    // And the hint "Each refresh uses Claude." is shown
    await expect(costHint(page)).toBeVisible()
    // And no interval options are visible
    for (const label of INTERVALS) await expect(interval(page, label)).toHaveCount(0)
  })

  // Scenario: HP-4 - Daily time survives save and reload
  test('HP-4: Daily time survives save and reload', async ({ page }) => {
    await openSettings(page)
    // When I choose the "Daily" refresh mode
    await mode(page, 'Daily').click()
    // And I set the time labelled "Every day at" to "07:30"
    await dailyTime(page).fill('07:30')
    await expect(dailyTime(page)).toHaveValue('07:30')
    // And I save my preferences
    const saved = page.waitForResponse(
      (r) => r.url().includes('/api/preferences') && r.request().method() === 'PUT',
    )
    await page.getByRole('button', { name: 'Save Preferences' }).click()
    const res = await saved
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.preferences).toMatchObject({ refreshMode: 'daily', refreshDailyTime: '07:30' })
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()
    // And I reload the Settings page
    const prefsLoaded = page.waitForResponse(
      (r) => r.url().includes('/api/preferences') && r.request().method() === 'GET',
    )
    await page.reload()
    await prefsLoaded
    // Then "Daily" is checked
    await expect(mode(page, 'Daily')).toHaveAttribute('aria-checked', 'true')
    await expect(mode(page, 'Manual')).toHaveAttribute('aria-checked', 'false')
    // And the time input labelled "Every day at" shows "07:30"
    await expect(dailyTime(page)).toHaveValue('07:30')
    // And the Auto-Refresh section says "Every day at 07:30. ..."
    await expect(section(page).getByText(`Every day at 07:30. ${CATCH_UP}`, { exact: true })).toBeVisible()
  })
  // Scenario: EC-1 - Clearing the daily time keeps the last valid time and the save still succeeds
  test('EC-1: Clearing the daily time keeps the last valid time and the save still succeeds', async ({ page }) => {
    await openSettings(page)
    // When I choose the "Daily" refresh mode
    await mode(page, 'Daily').click()
    // And I set the time labelled "Every day at" to "08:15"
    await dailyTime(page).fill('08:15')
    await expect(dailyTime(page)).toHaveValue('08:15')
    // And I clear the time labelled "Every day at"
    await dailyTime(page).fill('')
    // Then the time input labelled "Every day at" still shows "08:15"
    await expect(dailyTime(page)).toHaveValue('08:15')
    await expect(section(page).getByText(`Every day at 08:15. ${CATCH_UP}`, { exact: true })).toBeVisible()
    // When I save my preferences
    const saved = page.waitForResponse(
      (r) => r.url().includes('/api/preferences') && r.request().method() === 'PUT',
    )
    await page.getByRole('button', { name: 'Save Preferences' }).click()
    const res = await saved
    // Then the save succeeds with refresh mode "daily" and time "08:15"
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.preferences).toMatchObject({ refreshMode: 'daily', refreshDailyTime: '08:15' })
    await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()
  })
})
