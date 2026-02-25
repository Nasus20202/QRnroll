import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getLatest, listCodes, saveCode } from '../kv'

class FakeKV {
  store = new Map<string, string>()

  async get<T>(_key: string, opts?: { type?: 'json' }): Promise<T | null> {
    const raw = this.store.get(_key)
    if (!raw) return null
    if (opts?.type === 'json') {
      return JSON.parse(raw) as T
    }
    return raw as unknown as T
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value)
  }

  async list({ prefix }: { prefix?: string }) {
    const keys = Array.from(this.store.keys())
      .filter((k) => (prefix ? k.startsWith(prefix) : true))
      .map((name) => ({ name, expiration: null, metadata: null }))
    return { keys, list_complete: true as const, cacheStatus: null }
  }
}

describe('kv helpers', () => {
  const kv = new FakeKV()
  const env = { CODES: kv as unknown as KVNamespace } as Env

  beforeEach(() => {
    kv.store.clear()
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  it('saves first code and rejects duplicates', async () => {
    const first = await saveCode(env, 'foo')
    const second = await saveCode(env, 'foo')

    expect(first.stored).toBe(true)
    expect(second.stored).toBe(false)
    expect(second.reason).toBe('duplicate')
  })

  it('lists codes sorted by newest timestamp', async () => {
    vi.setSystemTime(1000)
    await saveCode(env, 'first')
    vi.setSystemTime(2000)
    await saveCode(env, 'second')

    const list = await listCodes(env)
    expect(list.map((c) => c.code)).toEqual(['second', 'first'])
  })

  it('returns latest code saved', async () => {
    vi.setSystemTime(3000)
    await saveCode(env, 'alpha')
    vi.setSystemTime(4000)
    await saveCode(env, 'beta')

    const latest = await getLatest(env)
    expect(latest?.code).toBe('beta')
    expect(latest?.ts).toBe(4000)
  })
})
