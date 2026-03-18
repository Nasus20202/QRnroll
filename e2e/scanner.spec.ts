import { expect, test } from '@playwright/test'

test.describe('Scanner Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('requests camera and displays video stream', async ({ page }) => {
    // The video element should eventually be visible
    const video = page.locator('video')
    await expect(video).toBeVisible()

    // Wait a bit to ensure no "Camera init error" appears
    await page.waitForTimeout(1000)
    await expect(page.locator('text=Camera init error')).not.toBeVisible()
  })

  test('prevents duplicate scans and shows warning', async ({ page }) => {
    test.setTimeout(15000) // Allow extra time for the 2-second cooldown wait

    // Wait for the E2E hook to be attached
    await page.waitForFunction(() => {
      const w = window as unknown as Record<string, unknown>
      return typeof w.__e2e_handleScan === 'function'
    })

    const testUrl = `https://example.com/qr/duplicate-test-${Date.now()}`

    // First scan
    await page.evaluate((code) => {
      // @ts-expect-error accessing E2E test hook
      window.__e2e_handleScan(code)
    }, testUrl)

    // Should show saved initially
    await expect(page.locator('text=Saved').first()).toBeVisible()

    // The app employs a 2000ms scan cooldown (SCAN_COOLDOWN_MS)
    // We must wait for the lock to release before sending the second scan.
    await page.waitForTimeout(2100)

    // Second scan of the EXACT same code
    await page.evaluate((code) => {
      // @ts-expect-error accessing E2E test hook
      window.__e2e_handleScan(code)
    }, testUrl)

    // Should show duplicate warning
    await expect(page.locator('text=Duplicate (ignored)').first()).toBeVisible()

    // The list should still only contain one entry for this code
    const listItems = page.locator('.group', { hasText: testUrl })
    await expect(listItems).toHaveCount(1)
  })

  test('copies scanned code to clipboard', async ({ page }) => {
    // Wait for the E2E hook to be attached
    await page.waitForFunction(() => {
      const w = window as unknown as Record<string, unknown>
      return typeof w.__e2e_handleScan === 'function'
    })

    const testUrl = `https://example.com/qr/clipboard-test-${Date.now()}`

    // Scan a code so it appears in the list
    await page.evaluate((code) => {
      // @ts-expect-error accessing E2E test hook
      window.__e2e_handleScan(code)
    }, testUrl)

    await expect(page.locator('text=Saved').first()).toBeVisible()

    // Find the row with our code and click its copy button
    const codeRow = page.locator('.group', { hasText: testUrl })
    const copyButton = codeRow.locator('button[aria-label="Copy code"]')

    await copyButton.click({ force: true })

    // Assert success toast/message is shown
    await expect(page.locator('text=Copied').first()).toBeVisible()

    // Verify the actual clipboard content
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    )
    expect(clipboardText).toBe(testUrl)
  })
})
