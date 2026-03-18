import valley from 'valley'

export type CodePayload = { code: string }

const nonEmptyString = (value: unknown): boolean | Error => {
  if (typeof value === 'string' && value.length > 0) return true
  return new Error('Code must be a non-empty string')
}

export const validateCodePayload = valley({ code: nonEmptyString })

export type StoredCode = {
  code: string
  ts: number
}

const store = new Map<string, StoredCode>()
let latest: StoredCode | null = null
export const TTL_SECONDS = 60

const CODE_PREFIX = 'code:'
const buildKey = (code: string) => `${CODE_PREFIX}${encodeURIComponent(code)}`

const pruneExpired = () => {
  const now = Date.now()
  for (const [key, value] of store.entries()) {
    if (now - value.ts > TTL_SECONDS * 1000) {
      store.delete(key)
    }
  }
  if (latest && now - latest.ts > TTL_SECONDS * 1000) {
    latest = null
  }
}

export async function saveCode(code: string) {
  pruneExpired()
  const key = buildKey(code)
  const existing = store.get(key)
  if (existing) {
    return { stored: false, reason: 'duplicate' as const }
  }

  const ts = Date.now()
  const record: StoredCode = { code, ts }
  store.set(key, record)
  latest = record

  return { stored: true, record }
}

export async function listCodes(): Promise<StoredCode[]> {
  pruneExpired()
  return Array.from(store.values()).sort((a, b) => b.ts - a.ts)
}

export async function getLatest(): Promise<StoredCode | null> {
  pruneExpired()
  return latest
}

// Test helper to reset in-memory store
export function __resetKV() {
  store.clear()
  latest = null
}
