import { expect, test } from '@playwright/test'

test('Scanner to Enroll full flow', async ({ page, context }) => {
  // Setup the enroll page in a second tab to monitor
  const enrollPage = await context.newPage()
  await enrollPage.goto('/enroll')
  await expect(enrollPage.getByText(/Enroll redirect/i)).toBeVisible()

  // Handle new pages (tabs) opened by the enroll page automatically
  const openedTabs: Array<string> = []
  context.on('page', async (newPage) => {
    // When a new tab is opened, record its URL
    await newPage.waitForLoadState()
    openedTabs.push(newPage.url())
  })

  // Switch to Scanner page
  await page.goto('/')

  // Verify camera loads
  const video = page.locator('video')
  await expect(video).toBeVisible()

  // Create a unique test code
  const testCodeId = `e2e-test-${Date.now()}`
  const testUrl = `https://example.com/qr/${testCodeId}`

  // Wait for the E2E hook to be attached
  await page.waitForFunction(() => {
    const w = window as unknown as Record<string, unknown>
    return typeof w.__e2e_handleScan === 'function'
  })

  // Trigger scan via our E2E hook
  await page.evaluate((code) => {
    // @ts-expect-error accessing E2E test hook attached in React component
    window.__e2e_handleScan(code)
  }, testUrl)

  // The scanner page should show a success message
  await expect(page.locator('text=Saved').first()).toBeVisible()

  // Check that it appears in the recent codes list on the scanner page
  await expect(page.getByText(testUrl).first()).toBeVisible()

  // Now verify that the Enroll page saw it and opened it in a new tab
  await enrollPage.bringToFront()

  // Verify it actually triggered a new tab with the test URL
  // The enroll page polls every second, wait up to 10s.
  await expect.poll(() => openedTabs, { timeout: 10000 }).toContain(testUrl)
})
