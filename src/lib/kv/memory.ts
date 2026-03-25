import type { KvBackend, StoredCode } from '@/lib/kv'
import { TTL_SECONDS } from '@/lib/kv'

const CODE_PREFIX = 'code:'
const buildKey = (code: string) => `${CODE_PREFIX}${encodeURIComponent(code)}`

export class MemoryKv implements KvBackend {
  private store = new Map<string, StoredCode>()
  private latest: StoredCode | null = null

  private pruneExpired() {
    const now = Date.now()
    for (const [key, value] of this.store.entries()) {
      if (now - value.ts > TTL_SECONDS * 1000) {
        this.store.delete(key)
      }
    }
    if (this.latest && now - this.latest.ts > TTL_SECONDS * 1000) {
      this.latest = null
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async saveCode(code: string) {
    this.pruneExpired()
    const key = buildKey(code)
    if (this.store.has(key)) {
      return {
        stored: false as const,
        reason: 'duplicate' as const,
      }
    }
    const ts = Date.now()
    const record: StoredCode = { code, ts }
    this.store.set(key, record)
    this.latest = record
    return { stored: true as const, record }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async listCodes() {
    this.pruneExpired()
    return Array.from(this.store.values()).sort((a, b) => b.ts - a.ts)
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async getLatest() {
    this.pruneExpired()
    return this.latest
  }

  async close() {
    // no-op
  }

  /** Test helper – resets internal state without touching the singleton. */
  reset() {
    this.store.clear()
    this.latest = null
  }
}
