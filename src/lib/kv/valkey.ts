import {
  ConditionalChange,
  GlideClient,
  InfBoundary,
} from '@valkey/valkey-glide'
import type { KvBackend, StoredCode } from '@/lib/kv'
import { TTL_SECONDS } from '@/lib/kv'

const CODES_KEY = 'codes'

export class ValkeyKv implements KvBackend {
  constructor(private readonly client: GlideClient) {}

  static async connect(url: string): Promise<ValkeyKv> {
    const parsed = new URL(url)
    const host = parsed.hostname
    const port = parseInt(parsed.port || '6379', 10)
    const client = await GlideClient.createClient({
      addresses: [{ host, port }],
    })
    return new ValkeyKv(client)
  }

  async saveCode(code: string) {
    const ts = Date.now()
    const minTs = ts - TTL_SECONDS * 1000

    // Prune old codes first so we don't treat an expired code as a duplicate
    await this.client.zremRangeByScore(
      CODES_KEY,
      InfBoundary.NegativeInfinity,
      { value: minTs, isInclusive: true },
    )

    // Try to add the new code
    const added = await this.client.zadd(
      CODES_KEY,
      { [code]: ts },
      { conditionalChange: ConditionalChange.ONLY_IF_DOES_NOT_EXIST },
    )

    if (added === 0) {
      return { stored: false as const, reason: 'duplicate' as const }
    }

    // Refresh the overall ZSET TTL so it cleans up when idle
    await this.client.expire(CODES_KEY, TTL_SECONDS)

    return { stored: true as const, record: { code, ts } }
  }

  async listCodes(): Promise<Array<StoredCode>> {
    const ts = Date.now()
    const minTs = ts - TTL_SECONDS * 1000

    const results = await this.client.zrangeWithScores(
      CODES_KEY,
      {
        type: 'byScore',
        start: InfBoundary.PositiveInfinity,
        end: { value: minTs, isInclusive: false },
      },
      { reverse: true },
    )

    return results.map((r) => ({
      code: typeof r.element === 'string' ? r.element : r.element.toString(),
      ts: r.score,
    }))
  }

  async getLatest(): Promise<StoredCode | null> {
    // Just fetch the one with highest score
    const results = await this.client.zrangeWithScores(
      CODES_KEY,
      { start: 0, end: 0 },
      { reverse: true },
    )

    if (results.length === 0) return null

    const r = results[0]

    // Make sure it hasn't expired (since we don't automatically prune on getLatest, though we could)
    if (Date.now() - r.score > TTL_SECONDS * 1000) {
      return null
    }

    return {
      code: typeof r.element === 'string' ? r.element : r.element.toString(),
      ts: r.score,
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async close() {
    this.client.close()
  }
}
