type WebhookResult = {
  url: string
  ok: boolean
  status: number
  error?: string
}

const WEBHOOK_TIMEOUT_MS = 5000
const RETRIES = 2

export function getWebhookTargets(env: Env): string[] {
  const raw = (env.WEBHOOK_URLS || env.WEBHOOK_URL || '').toString()
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function postOnce(url: string, payload: unknown): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

export async function fanOutWebhooks(
  env: Env,
  payload: unknown,
): Promise<WebhookResult[]> {
  const targets = getWebhookTargets(env)
  if (!targets.length) return []

  const attempts = async (url: string): Promise<WebhookResult> => {
    let lastError: string | undefined
    for (let i = 0; i <= RETRIES; i++) {
      try {
        const res = await postOnce(url, payload)
        if (res.ok) {
          return { url, ok: true, status: res.status }
        }
        lastError = `status ${res.status}`
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'unknown error'
      }
    }
    return { url, ok: false, status: 0, error: lastError }
  }

  const results = await Promise.all(targets.map((url) => attempts(url)))
  return results
}

declare global {
  interface Env {
    WEBHOOK_URLS?: string
    WEBHOOK_URL?: string
  }
}
