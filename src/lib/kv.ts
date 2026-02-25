import { z } from 'zod'

export const codePayloadSchema = z.object({
  code: z.string().min(1, 'Code is required'),
})

export type CodePayload = z.infer<typeof codePayloadSchema>

export type StoredCode = {
  code: string
  ts: number
}

const CODE_PREFIX = 'code:'
const LATEST_KEY = 'latest'
export const TTL_SECONDS = 60

const buildKey = (code: string) => `${CODE_PREFIX}${encodeURIComponent(code)}`

export async function saveCode(env: Env, code: string) {
  const key = buildKey(code)
  const existing = await env.CODES.get<StoredCode>(key, { type: 'json' })
  if (existing) {
    return { stored: false, reason: 'duplicate' as const }
  }

  const ts = Date.now()
  const record: StoredCode = { code, ts }

  await Promise.all([
    env.CODES.put(key, JSON.stringify(record), { expirationTtl: TTL_SECONDS }),
    env.CODES.put(LATEST_KEY, JSON.stringify(record), {
      expirationTtl: TTL_SECONDS,
    }),
  ])

  return { stored: true, record }
}

export async function listCodes(env: Env): Promise<StoredCode[]> {
  const list = await env.CODES.list({ prefix: CODE_PREFIX })
  if (!list.keys.length) return []
  const values = await Promise.all(
    list.keys.map(async (item: KVNamespaceListKey<unknown, string>) => {
      const val = await env.CODES.get<StoredCode>(item.name, { type: 'json' })
      return val ?? null
    }),
  )

  return values
    .filter((v): v is StoredCode => Boolean(v))
    .sort((a: StoredCode, b: StoredCode) => b.ts - a.ts)
}

export async function getLatest(env: Env): Promise<StoredCode | null> {
  const latest = await env.CODES.get<StoredCode>(LATEST_KEY, { type: 'json' })
  return latest ?? null
}

declare global {
  interface Env {
    CODES: KVNamespace
  }
}
