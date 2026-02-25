import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import { codePayloadSchema, listCodes, saveCode } from '@/lib/kv'
import { fanOutWebhooks } from '@/lib/webhooks'

export const postCode = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data?: unknown }) => {
    const parse = codePayloadSchema.safeParse(data)
    if (!parse.success) {
      return Response.json(
        { ok: false, error: parse.error.format() },
        { status: 400 },
      )
    }

    const { code } = parse.data
    const stored = await saveCode(env, code)
    if (stored.stored) {
      await fanOutWebhooks(env, { code, ts: stored.record?.ts ?? Date.now() })
    }
    return {
      ok: true,
      stored: stored.stored,
      reason: stored.reason,
      ts: stored.record?.ts ?? null,
    }
  },
)

export const getCodes = createServerFn({ method: 'GET' }).handler(async () => {
  const now = Date.now()
  const codes = await listCodes(env)
  return codes.filter((c) => now - c.ts <= 15_000)
})

export type CodesResponse = Awaited<ReturnType<typeof getCodes>>
export type SubmitResponse = Awaited<ReturnType<typeof postCode>>
