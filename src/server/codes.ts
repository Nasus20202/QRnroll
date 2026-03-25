import { createServerFn } from '@tanstack/react-start'
import { codePayloadSchema, listCodes, saveCode } from '@/lib/kv'
import { fanOutWebhooks } from '@/lib/webhooks'

type StoreOutcome =
  | { status: 'new'; ts: number }
  | { status: 'duplicate' }
  | { status: 'error' }

async function getStoreOutcome(code: string): Promise<StoreOutcome> {
  try {
    const result = await saveCode(code)
    return result.stored
      ? { status: 'new', ts: result.record.ts }
      : { status: 'duplicate' }
  } catch (err) {
    console.error('[submit] store error for code:', code, err)
    return { status: 'error' }
  }
}

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
    const outcome = await getStoreOutcome(code)
    const ts = outcome.status === 'new' ? outcome.ts : Date.now()

    if (outcome.status !== 'duplicate') {
      await fanOutWebhooks(
        `[QR code received at ${new Date(ts).toISOString()}](${code})`,
      )
    }

    console.log('[submit] code:', code, 'status:', outcome.status)
    return {
      ok: outcome.status !== 'error',
      stored: outcome.status === 'new',
      reason:
        outcome.status === 'duplicate'
          ? ('duplicate' as const)
          : outcome.status === 'error'
            ? ('store error' as const)
            : undefined,
      ts: outcome.status === 'new' ? outcome.ts : null,
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
