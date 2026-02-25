import { beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetKV, getLatest, listCodes, saveCode } from '../kv'

describe('kv helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    __resetKV()
  })

  it('saves first code and rejects duplicates', async () => {
    const first = await saveCode('foo')
    const second = await saveCode('foo')

    expect(first.stored).toBe(true)
    expect(second.stored).toBe(false)
    expect(second.reason).toBe('duplicate')
  })

  it('lists codes sorted by newest timestamp', async () => {
    vi.setSystemTime(1000)
    await saveCode('first')
    vi.setSystemTime(2000)
    await saveCode('second')

    const list = await listCodes()
    expect(list.map((c) => c.code)).toEqual(['second', 'first'])
  })

  it('returns latest code saved', async () => {
    vi.setSystemTime(3000)
    await saveCode('alpha')
    vi.setSystemTime(4000)
    await saveCode('beta')

    const latest = await getLatest()
    expect(latest?.code).toBe('beta')
    expect(latest?.ts).toBe(4000)
  })
})
