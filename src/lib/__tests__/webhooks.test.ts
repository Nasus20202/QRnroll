import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fanOutWebhooks, getWebhookTargets } from '../webhooks'

const originalEnv = { ...process.env }

const resetEnv = () => {
  process.env.WEBHOOK_URLS = originalEnv.WEBHOOK_URLS
  process.env.WEBHOOK_URL = originalEnv.WEBHOOK_URL
}

describe('getWebhookTargets', () => {
  afterEach(() => {
    resetEnv()
  })

  it('splits comma-separated URLs and trims blanks', () => {
    process.env.WEBHOOK_URLS = ' https://a.test , https://b.test,, '
    expect(getWebhookTargets()).toEqual(['https://a.test', 'https://b.test'])
  })

  it('returns empty array when nothing set', () => {
    process.env.WEBHOOK_URLS = ''
    expect(getWebhookTargets()).toEqual([])
  })
})

describe('fanOutWebhooks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetEnv()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    resetEnv()
  })

  it('returns empty when no targets', async () => {
    process.env.WEBHOOK_URLS = ''
    const results = await fanOutWebhooks('x')
    expect(results).toEqual([])
  })

  it('posts to all targets and reports success', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }))

    process.env.WEBHOOK_URLS = 'https://a.test,https://b.test'
    const resultsPromise = fanOutWebhooks('abc')

    // flush timers for abort controller safety
    await vi.runAllTimersAsync()
    const results = await resultsPromise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://a.test',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://b.test',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(results).toHaveLength(2)
    expect(results.every((r) => r.ok)).toBe(true)
  })
})
