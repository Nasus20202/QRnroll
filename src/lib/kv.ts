import valley from 'valley'
import type { GlideClient } from '@valkey/valkey-glide'

// ---------- validation ----------

export type CodePayload = { code: string }

const nonEmptyString = (value: unknown): boolean | Error => {
  if (typeof value === 'string' && value.length > 0) return true
  return new Error('Code must be a non-empty string')
}

export const validateCodePayload = valley({ code: nonEmptyString })

// ---------- shared types ----------

export type StoredCode = {
  code: string
  ts: number
}

export const TTL_SECONDS = 60
const TTL_MS = TTL_SECONDS * 1000

// ---------- Valkey backend ----------

const CODES_KEY = 'qrnroll:codes'
const LATEST_KEY = 'qrnroll:latest'

let _glideClient: GlideClient | null = null
let _glideInitPromise: Promise<GlideClient | null> | null = null

async function getGlideClient(): Promise<GlideClient | null> {
  const host = process.env['VALKEY_HOST']
  if (!host) return null
  if (_glideInitPromise) return _glideInitPromise

  _glideInitPromise = (async () => {
    const { GlideClient: Glide } = await import('@valkey/valkey-glide')
    _glideClient = await Glide.createClient({
      addresses: [{ host, port: Number(process.env['VALKEY_PORT'] ?? 6379) }],
      clientName: 'qrnroll',
    })
    return _glideClient
  })()

  return _glideInitPromise
}

async function saveCodeValkey(client: GlideClient, code: string) {
  const { ConditionalChange, InfBoundary, TimeUnit } = await import(
    '@valkey/valkey-glide'
  )
  const now = Date.now()
  const minScore = now - TTL_MS

  await client.zremRangeByScore(CODES_KEY, InfBoundary.NegativeInfinity, {
    value: minScore,
    isInclusive: false,
  })

  const added = await client.zadd(
    CODES_KEY,
    { [code]: now },
    { conditionalChange: ConditionalChange.ONLY_IF_DOES_NOT_EXIST },
  )

  if (added === 0) {
    return { stored: false, reason: 'duplicate' as const }
  }

  const record: StoredCode = { code, ts: now }
  await client.set(LATEST_KEY, JSON.stringify(record), {
    expiry: { type: TimeUnit.Seconds, count: TTL_SECONDS },
  })

  return { stored: true, record }
}

async function listCodesValkey(client: GlideClient): Promise<StoredCode[]> {
  const { InfBoundary } = await import('@valkey/valkey-glide')
  const now = Date.now()
  const minScore = now - TTL_MS

  await client.zremRangeByScore(CODES_KEY, InfBoundary.NegativeInfinity, {
    value: minScore,
    isInclusive: false,
  })

  const entries = await client.zrangeWithScores(
    CODES_KEY,
    {
      start: InfBoundary.PositiveInfinity,
      end: { value: minScore, isInclusive: true },
      type: 'byScore',
    },
    { reverse: true },
  )

  return entries.map(({ element, score }) => ({
    code: element.toString(),
    ts: score,
  }))
}

async function getLatestValkey(
  client: GlideClient,
): Promise<StoredCode | null> {
  const raw = await client.get(LATEST_KEY)
  if (!raw) return null
  return JSON.parse(raw.toString()) as StoredCode
}

// ---------- in-memory backend ----------

const store = new Map<string, StoredCode>()
let latest: StoredCode | null = null

const CODE_PREFIX = 'code:'
const buildKey = (code: string) => `${CODE_PREFIX}${encodeURIComponent(code)}`

const pruneExpired = () => {
  const now = Date.now()
  for (const [key, value] of store.entries()) {
    if (now - value.ts > TTL_MS) {
      store.delete(key)
    }
  }
  if (latest && now - latest.ts > TTL_MS) {
    latest = null
  }
}

function saveCodeMemory(code: string) {
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

// ---------- public API ----------

export async function saveCode(code: string) {
  const client = await getGlideClient()
  if (client) return saveCodeValkey(client, code)
  return saveCodeMemory(code)
}

export async function listCodes(): Promise<StoredCode[]> {
  const client = await getGlideClient()
  if (client) return listCodesValkey(client)
  pruneExpired()
  return Array.from(store.values()).sort((a, b) => b.ts - a.ts)
}

export async function getLatest(): Promise<StoredCode | null> {
  const client = await getGlideClient()
  if (client) return getLatestValkey(client)
  pruneExpired()
  return latest
}

// ---------- test helpers ----------

/** Reset in-memory state (unit tests). Closes any open Valkey connection. */
export function __resetKV() {
  store.clear()
  latest = null
  _glideClient?.close()
  _glideClient = null
  _glideInitPromise = null
}

/** Delete Valkey keys (integration tests). Reuses the existing connection. */
export async function __resetKVValkey() {
  const client = await getGlideClient()
  if (client) {
    await client.del([CODES_KEY, LATEST_KEY])
  }
}
