import { createServerFn } from '@tanstack/react-start'
import { codePayloadSchema, listCodes, saveCode } from '@/lib/kv'
import { fanOutWebhooks } from '@/lib/webhooks'

export const postCode = createServerFn({ method: 'POST' }).handler(
  async ({ data }: { data?: unknown }) => {
    const parse = codePayloadSchema.safeParse(data)
    if (!parse.success) {
      return Response.json(
        { ok: false, error: parse.error.message },
        { status: 400 },
      )
    }

    const { code } = parse.data
    let stored: Awaited<ReturnType<typeof saveCode>>
    try {
      stored = await saveCode(code)
    } catch (err) {
      console.error('[submit] store error for code:', code, err)
      const ts = Date.now()
      await fanOutWebhooks(
        `[QR code received at ${new Date(ts).toISOString()}](${code})`,
      )
      return {
        ok: false,
        stored: false as const,
        reason: 'store error' as const,
        ts: null,
      }
    }
    if (stored.stored) {
      const ts = stored.record.ts
      await fanOutWebhooks(
        `[QR code received at ${new Date(ts).toISOString()}](${code})`,
      )
    }
    console.log('[submit] code:', code, 'stored:', stored.stored)
    return {
      ok: true,
      stored: stored.stored,
      reason: stored.stored ? undefined : stored.reason,
      ts: stored.stored ? stored.record.ts : null,
    }
  },
)

export const getCodes = createServerFn({ method: 'GET' }).handler(async () => {
  const now = Date.now()
  const codes = await listCodes()
  return codes.filter((c) => now - c.ts <= 15_000)
})

export type CodesResponse = Awaited<ReturnType<typeof getCodes>>
export type SubmitResponse = Awaited<ReturnType<typeof postCode>>
