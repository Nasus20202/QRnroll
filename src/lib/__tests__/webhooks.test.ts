import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fanOutWebhooks, getWebhookTargets } from '../webhooks'

describe('getWebhookTargets', () => {
  it('splits comma-separated URLs and trims blanks', () => {
    const env = { WEBHOOK_URLS: ' https://a.test , https://b.test,, ' } as Env
    expect(getWebhookTargets(env)).toEqual(['https://a.test', 'https://b.test'])
  })

  it('falls back to WEBHOOK_URL', () => {
    const env = { WEBHOOK_URL: 'https://single.test' } as Env
    expect(getWebhookTargets(env)).toEqual(['https://single.test'])
  })

  it('returns empty array when nothing set', () => {
    expect(getWebhookTargets({} as Env)).toEqual([])
  })
})

describe('fanOutWebhooks', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns empty when no targets', async () => {
    const results = await fanOutWebhooks({} as Env, { code: 'x' })
    expect(results).toEqual([])
  })

  it('posts to all targets and reports success', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as unknown as typeof fetch

    fetchMock.mockResolvedValue(new Response('ok', { status: 200 }))

    const env = { WEBHOOK_URLS: 'https://a.test,https://b.test' } as Env
    const resultsPromise = fanOutWebhooks(env, { code: 'abc', ts: Date.now() })

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
