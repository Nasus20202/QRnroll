import { beforeEach, describe, expect, it, vi } from 'vitest'

import { __resetKV, getLatest, listCodes, saveCode, validateCodePayload } from '@/lib/kv'

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

describe('validateCodePayload', () => {
  it('returns null for a valid code payload', () => {
    expect(validateCodePayload({ code: 'abc123' })).toBeNull()
  })

  it('returns an error for a missing code field', () => {
    const result = validateCodePayload({})
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an error for an empty string code', () => {
    const result = validateCodePayload({ code: '' })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an error for a non-string code', () => {
    const result = validateCodePayload({ code: 42 })
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an error for non-object input', () => {
    const result = validateCodePayload('not-an-object')
    expect(result).toBeInstanceOf(Error)
  })

  it('returns an error for unknown extra keys', () => {
    const result = validateCodePayload({ code: 'abc', extra: 'field' })
    expect(result).toBeInstanceOf(Error)
    expect(result?.message).toMatch(/extra/)
  })
})
