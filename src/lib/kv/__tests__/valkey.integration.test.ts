import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ValkeyKv } from '@/lib/kv/valkey'

// We require a real Valkey instance for this test.
// By default we assume it is running on localhost:6379 via docker-compose.
const VALKEY_URL =
  process.env.VALKEY_URL || process.env.REDIS_URL || 'valkey://localhost:6379'

describe('ValkeyKv Integration', () => {
  let kv: ValkeyKv

  beforeAll(async () => {
    try {
      kv = await ValkeyKv.connect(VALKEY_URL)
    } catch (err) {
      console.warn(
        `Failed to connect to Valkey at ${VALKEY_URL}. Is it running?`,
      )
      throw err
    }
  })

  afterAll(async () => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (kv) {
      // @ts-expect-error accessing private client for cleanup
      const client = kv.client
      await client.del(['codes'])
      await kv.close()
    }
  })

  it('saves first code and rejects duplicates', async () => {
    // Generate unique code so tests don't flake on re-runs
    const code = `foo-${Date.now()}-${Math.random()}`

    const first = await kv.saveCode(code)
    const second = await kv.saveCode(code)

    expect(first.stored).toBe(true)
    expect(second.stored).toBe(false)
    if (!second.stored) {
      expect(second.reason).toBe('duplicate')
    }
  })

  it('lists codes', async () => {
    const code1 = `list-first-${Date.now()}`
    const code2 = `list-second-${Date.now()}`

    await kv.saveCode(code1)
    await kv.saveCode(code2)

    const list = await kv.listCodes()

    // Valkey is async, the order might be identical ts or slightly off,
    // but both should be in the list
    expect(list.some((c) => c.code === code1)).toBe(true)
    expect(list.some((c) => c.code === code2)).toBe(true)
  })

  it('returns latest code saved', async () => {
    const code1 = `latest-alpha-${Date.now()}`
    const code2 = `latest-beta-${Date.now()}`

    await kv.saveCode(code1)
    // small delay to ensure ts is strictly >
    await new Promise((r) => setTimeout(r, 10))
    await kv.saveCode(code2)

    const latest = await kv.getLatest()
    expect(latest?.code).toBe(code2)
  })
})
