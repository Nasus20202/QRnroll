import { z } from 'zod'

import { MemoryKv } from '@/lib/kv-memory'
import { ValkeyKv } from '@/lib/kv-valkey'

export const codePayloadSchema = z.object({
  code: z.string().min(1, 'Code is required'),
})

export type CodePayload = z.infer<typeof codePayloadSchema>

export type StoredCode = {
  code: string
  ts: number
}

export const TTL_SECONDS = 60

// ---------------------------------------------------------------------------
// KV backend interface
// ---------------------------------------------------------------------------

export interface KvBackend {
  saveCode: (
    code: string,
  ) => Promise<
    | { stored: false; reason: 'duplicate' }
    | { stored: true; record: StoredCode }
  >
  listCodes: () => Promise<Array<StoredCode>>
  getLatest: () => Promise<StoredCode | null>
  /** Release any underlying connections. No-op for in-memory backend. */
  close: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Singleton factory – reads VALKEY_URL from environment
// ---------------------------------------------------------------------------

let _backend: KvBackend | null = null

/**
 * Returns the process-level KV backend singleton.
 *
 * Backend selection (in priority order):
 *   1. VALKEY_URL is set → ValkeyKv (connects on first call)
 *   2. Default          → MemoryKv
 *
 * Accepted URL formats: `valkey://host:port`  or  `redis://host:port`
 */
export async function getKvBackend(): Promise<KvBackend> {
  if (_backend) return _backend
  const url = process.env.VALKEY_URL || process.env.REDIS_URL
  if (url) {
    _backend = await ValkeyKv.connect(url)
    const safeUrl = url.replace(/\/\/.*@/, '//***:***@') // redact credentials if present
    console.log(`[kv] using Valkey backend: ${safeUrl}`)
  } else {
    _backend = new MemoryKv()
    console.log('[kv] using in-memory backend')
  }
  return _backend
}

// ---------------------------------------------------------------------------
// Public API – thin wrappers that delegate to the active backend
// ---------------------------------------------------------------------------

export async function saveCode(code: string) {
  const backend = await getKvBackend()
  return backend.saveCode(code)
}

export async function listCodes(): Promise<Array<StoredCode>> {
  const backend = await getKvBackend()
  return backend.listCodes()
}

export async function getLatest(): Promise<StoredCode | null> {
  const backend = await getKvBackend()
  return backend.getLatest()
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Resets the module-level singleton so tests can swap backends freely.
 * Also resets in-memory state when using MemoryKv.
 * @internal
 */
export function __resetKV(backend?: KvBackend) {
  if (backend !== undefined) {
    _backend = backend
  } else {
    if (_backend instanceof MemoryKv) {
      _backend.reset()
    } else {
      _backend = null
    }
  }
}
