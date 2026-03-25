import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fanOutWebhooks } from '@/lib/webhooks'
import { saveCode } from '@/lib/kv'
import { postCode } from '@/server/codes'

// Mock @tanstack/react-start so createServerFn passes the handler through
vi.mock('@tanstack/react-start', () => ({
  createServerFn: () => ({
    handler: (fn: (ctx: { data?: unknown }) => unknown) => fn,
  }),
}))

// Mock the KV helpers
vi.mock('@/lib/kv', () => ({
  codePayloadSchema: {
    safeParse: (data: unknown) => {
      if (
        data !== null &&
        typeof data === 'object' &&
        'code' in data &&
        typeof (data as Record<string, unknown>).code === 'string' &&
        (data as Record<string, unknown>).code !== ''
      ) {
        return { success: true, data: { code: (data as { code: string }).code } }
      }
      return { success: false, error: { message: 'invalid' } }
    },
  },
  saveCode: vi.fn(),
  listCodes: vi.fn(),
}))

// Mock the webhook fan-out
vi.mock('@/lib/webhooks', () => ({
  fanOutWebhooks: vi.fn().mockResolvedValue([]),
}))

const mockSaveCode = vi.mocked(saveCode)
const mockFanOut = vi.mocked(fanOutWebhooks)

// After our mock, createServerFn().handler(fn) returns fn directly, so postCode
// is the raw async handler. Cast to its actual call signature for test calls.
const handler = postCode as unknown as (ctx: { data?: unknown }) => Promise<unknown>

describe('postCode handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fans out webhooks after a successful store', async () => {
    const mockTimestamp = 1_000_000
    mockSaveCode.mockResolvedValueOnce({
      stored: true,
      record: { code: 'https://example.com', ts: mockTimestamp },
    })

    const result = await handler({ data: { code: 'https://example.com' } })

    expect(mockFanOut).toHaveBeenCalledOnce()
    expect(mockFanOut).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com'),
    )
    expect(result).toMatchObject({ ok: true, stored: true, ts: mockTimestamp })
  })

  it('does not fan out webhooks for a duplicate code', async () => {
    mockSaveCode.mockResolvedValueOnce({ stored: false, reason: 'duplicate' })

    const result = await handler({ data: { code: 'https://example.com' } })

    expect(mockFanOut).not.toHaveBeenCalled()
    expect(result).toMatchObject({ ok: true, stored: false, reason: 'duplicate' })
  })

  it('fans out webhooks as fallback when the store throws an error', async () => {
    mockSaveCode.mockRejectedValueOnce(new Error('connection refused'))

    const result = await handler({ data: { code: 'https://example.com' } })

    expect(mockFanOut).toHaveBeenCalledOnce()
    expect(mockFanOut).toHaveBeenCalledWith(
      expect.stringContaining('https://example.com'),
    )
    expect(result).toMatchObject({ ok: false, stored: false, reason: 'store error' })
  })

  it('returns 400 for invalid payload without fanning out', async () => {
    const result = (await handler({ data: { code: '' } })) as Response
    expect(result).toBeInstanceOf(Response)
    expect(result.status).toBe(400)
    expect(mockFanOut).not.toHaveBeenCalled()
  })
})
