import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { KvBackend } from '@/lib/kv'
import {
  CircuitBreakerKv,
  DEFAULT_RECOVERY_MS,
  DEFAULT_THRESHOLD,
} from '@/lib/kv/circuit-breaker'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePrimary(overrides?: Partial<KvBackend>): KvBackend {
  return {
    saveCode: vi.fn().mockResolvedValue({
      stored: true as const,
      record: { code: 'a', ts: 0 },
    }),
    listCodes: vi.fn().mockResolvedValue([]),
    getLatest: vi.fn().mockResolvedValue(null),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeFallback(): KvBackend {
  return {
    saveCode: vi.fn().mockResolvedValue({
      stored: true as const,
      record: { code: 'a', ts: 0 },
    }),
    listCodes: vi.fn().mockResolvedValue([{ code: 'fallback', ts: 1000 }]),
    getLatest: vi.fn().mockResolvedValue({ code: 'fallback', ts: 1000 }),
    close: vi.fn().mockResolvedValue(undefined),
  }
}

const ERR = new Error('connection refused')

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CircuitBreakerKv', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exposes default threshold and recoveryMs constants', () => {
    const cb = new CircuitBreakerKv(makePrimary(), makeFallback())
    expect(cb.threshold).toBe(DEFAULT_THRESHOLD)
    expect(cb.recoveryMs).toBe(DEFAULT_RECOVERY_MS)
  })

  it('delegates all operations to primary when circuit is closed', async () => {
    const primary = makePrimary()
    const fallback = makeFallback()
    const cb = new CircuitBreakerKv(primary, fallback)

    await cb.saveCode('x')
    await cb.listCodes()
    await cb.getLatest()

    expect(primary.saveCode).toHaveBeenCalledOnce()
    expect(primary.listCodes).toHaveBeenCalledOnce()
    expect(primary.getLatest).toHaveBeenCalledOnce()
    expect(fallback.saveCode).not.toHaveBeenCalled()
    expect(fallback.listCodes).not.toHaveBeenCalled()
    expect(fallback.getLatest).not.toHaveBeenCalled()
    expect(cb.state).toBe('closed')
  })

  it('does not increment failures on successful operations', async () => {
    const cb = new CircuitBreakerKv(makePrimary(), makeFallback(), 3, 30_000)

    await cb.saveCode('a')
    await cb.saveCode('b')
    await cb.saveCode('c')

    expect(cb.state).toBe('closed')
    expect(cb.failures).toBe(0)
  })

  it('opens the circuit after reaching the failure threshold', async () => {
    const primary = makePrimary({ saveCode: vi.fn().mockRejectedValue(ERR) })
    const fallback = makeFallback()
    const cb = new CircuitBreakerKv(primary, fallback, 3, 30_000)

    await cb.saveCode('1')
    expect(cb.state).toBe('closed')
    expect(cb.failures).toBe(1)

    await cb.saveCode('2')
    expect(cb.state).toBe('closed')
    expect(cb.failures).toBe(2)

    await cb.saveCode('3')
    expect(cb.state).toBe('open')

    // Fallback should have been used for all three failing calls
    expect(fallback.saveCode).toHaveBeenCalledTimes(3)
  })

  it('routes directly to fallback when circuit is open (skips primary)', async () => {
    const primary = makePrimary({ saveCode: vi.fn().mockRejectedValue(ERR) })
    const fallback = makeFallback()
    const cb = new CircuitBreakerKv(primary, fallback, 1, 30_000)

    // Trip the circuit
    await cb.saveCode('trip')
    expect(cb.state).toBe('open')

    vi.mocked(primary.saveCode).mockClear()
    vi.mocked(fallback.saveCode).mockClear()

    // Next call must not touch primary at all
    await cb.saveCode('after-open')
    expect(primary.saveCode).not.toHaveBeenCalled()
    expect(fallback.saveCode).toHaveBeenCalledOnce()
  })

  it('transitions to half-open after the recovery period elapses', async () => {
    const primary = makePrimary({ saveCode: vi.fn().mockRejectedValue(ERR) })
    const fallback = makeFallback()
    const cb = new CircuitBreakerKv(primary, fallback, 1, 30_000)

    // Trip the circuit at t=0
    await cb.saveCode('trip')
    expect(cb.state).toBe('open')

    // Advance past recovery window
    vi.setSystemTime(30_001)

    // The probe call should try primary (half-open probe), fail, and re-open
    await cb.saveCode('probe')
    expect(cb.state).toBe('open')
    // Primary was called twice: once to trip, once as the half-open probe
    expect(vi.mocked(primary.saveCode)).toHaveBeenCalledTimes(2)
  })

  it('closes circuit when half-open probe succeeds', async () => {
    const saveCode = vi
      .fn()
      .mockRejectedValueOnce(ERR)
      .mockResolvedValue({
        stored: true as const,
        record: { code: 'x', ts: 0 },
      })

    const primary = makePrimary({ saveCode })
    const fallback = makeFallback()
    const cb = new CircuitBreakerKv(primary, fallback, 1, 30_000)

    // Trip the circuit
    await cb.saveCode('trip')
    expect(cb.state).toBe('open')

    // Advance past recovery window
    vi.setSystemTime(30_001)

    // Probe succeeds → circuit closes
    await cb.saveCode('recover')
    expect(cb.state).toBe('closed')
    expect(cb.failures).toBe(0)
    // Recovery call went to primary, not fallback
    expect(vi.mocked(fallback.saveCode)).toHaveBeenCalledTimes(1) // only for the trip call
  })

  it('resets the recovery timer when re-opening from half-open', async () => {
    const saveCode = vi.fn().mockRejectedValue(ERR)
    const primary = makePrimary({ saveCode })
    const fallback = makeFallback()
    const cb = new CircuitBreakerKv(primary, fallback, 1, 30_000)

    // Trip the circuit at t=0
    await cb.saveCode('trip')
    expect(cb.state).toBe('open')

    // Advance to half-open probe
    vi.setSystemTime(30_001)
    await cb.saveCode('probe-fail') // primary still fails → re-opens, openedAt reset to 30_001
    expect(cb.state).toBe('open')

    // Going back 1ms should NOT yet allow another probe (timer reset)
    vi.setSystemTime(30_001 + 29_999)
    await cb.saveCode('too-soon')
    expect(vi.mocked(primary.saveCode)).toHaveBeenCalledTimes(2) // trip + probe only, not this one
  })

  it('works for listCodes and getLatest too', async () => {
    const primary = makePrimary({
      listCodes: vi.fn().mockRejectedValue(ERR),
      getLatest: vi.fn().mockRejectedValue(ERR),
    })
    const fallback = makeFallback()
    const cb = new CircuitBreakerKv(primary, fallback, 1, 30_000)

    // Trip via listCodes
    await cb.listCodes()
    expect(cb.state).toBe('open')
    expect(fallback.listCodes).toHaveBeenCalledOnce()

    vi.setSystemTime(30_001)

    // Probe via getLatest (half-open, primary still fails → re-opens)
    await cb.getLatest()
    expect(cb.state).toBe('open')
  })

  it('logs each individual failure and the circuit-opened event', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const primary = makePrimary({ saveCode: vi.fn().mockRejectedValue(ERR) })
    const cb = new CircuitBreakerKv(primary, makeFallback(), 3, 30_000)

    await cb.saveCode('1')
    await cb.saveCode('2')
    await cb.saveCode('3')

    // One per-failure log per call
    expect(errorSpy).toHaveBeenCalledWith(
      '[circuit-breaker] primary error on saveCode (failure 1/3):',
      ERR,
    )
    expect(errorSpy).toHaveBeenCalledWith(
      '[circuit-breaker] primary error on saveCode (failure 2/3):',
      ERR,
    )
    expect(errorSpy).toHaveBeenCalledWith(
      '[circuit-breaker] primary error on saveCode (failure 3/3):',
      ERR,
    )
    // Circuit-opened log (no error object attached)
    expect(errorSpy).toHaveBeenCalledWith(
      '[circuit-breaker] open: primary backend unavailable, switching to in-memory fallback',
    )

    errorSpy.mockRestore()
  })

  it('logs circuit closed when half-open probe succeeds', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const saveCode = vi
      .fn()
      .mockRejectedValueOnce(ERR)
      .mockResolvedValue({
        stored: true as const,
        record: { code: 'x', ts: 0 },
      })
    const cb = new CircuitBreakerKv(
      makePrimary({ saveCode }),
      makeFallback(),
      1,
      30_000,
    )

    await cb.saveCode('trip')
    vi.setSystemTime(30_001)
    await cb.saveCode('recover')

    expect(logSpy).toHaveBeenCalledWith(
      '[circuit-breaker] closed: primary backend recovered',
    )

    logSpy.mockRestore()
    vi.mocked(console.error).mockRestore()
  })

  it('closes both primary and fallback on close()', async () => {
    const primary = makePrimary()
    const fallback = makeFallback()
    const cb = new CircuitBreakerKv(primary, fallback)

    await cb.close()

    expect(primary.close).toHaveBeenCalledOnce()
    expect(fallback.close).toHaveBeenCalledOnce()
  })
})
