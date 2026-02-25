type WebhookResult = {
  url: string
  ok: boolean
  status: number
  error?: string
}

const WEBHOOK_TIMEOUT_MS = 5000
const RETRIES = 2

export function getWebhookTargets(): string[] {
  const raw = (process.env.WEBHOOK_URLS ?? '').toString()
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

const normalizePayload = (payload: string): { content: string } => ({
  content: payload,
})

async function postOnce(url: string, payload: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    const body = normalizePayload(payload)
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function fanOutWebhooks(
  payload: string,
): Promise<WebhookResult[]> {
  const targets = getWebhookTargets()
  if (!targets.length) return []

  console.log(`[webhook] sending payload to ${targets.length} targets`)
  const attempts = async (url: string): Promise<WebhookResult> => {
    let lastError: string | undefined
    for (let i = 0; i <= RETRIES; i++) {
      try {
        const res = await postOnce(url, payload)
        console.log(res)
        if (res.status >= 200 && res.status < 300) {
          return { url, ok: true, status: res.status }
        }
        lastError = `${res.status}: ${await res.text()}`
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'unknown error'
      }
      console.error('[webhook] failed', url, lastError)
    }
    return { url, ok: false, status: 0, error: lastError }
  }

  const results = await Promise.all(targets.map((url) => attempts(url)))
  return results
}
