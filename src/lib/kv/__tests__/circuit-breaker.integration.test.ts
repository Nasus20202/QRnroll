import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { CircuitBreakerKv } from '@/lib/kv/circuit-breaker'
import { MemoryKv } from '@/lib/kv/memory'
import { ValkeyKv } from '@/lib/kv/valkey'

// We require a real Valkey instance for this test.
// By default we assume it is running on localhost:6379 via docker-compose.
const VALKEY_URL =
  process.env.VALKEY_URL || process.env.REDIS_URL || 'valkey://localhost:6379'

describe('CircuitBreakerKv Integration', () => {
  describe('Valkey available', () => {
    let primary: ValkeyKv
    let cb: CircuitBreakerKv

    beforeAll(async () => {
      primary = await ValkeyKv.connect(VALKEY_URL)
      cb = new CircuitBreakerKv(primary, new MemoryKv())
    })

    afterAll(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (cb) await cb.close()
    })

    it('uses the primary Valkey backend when it is healthy', async () => {
      const code = `cb-healthy-${Date.now()}-${Math.random()}`
      const result = await cb.saveCode(code)
      expect(result.stored).toBe(true)
      expect(cb.state).toBe('closed')
      expect(cb.failures).toBe(0)
    })

    it('lists codes via the primary backend', async () => {
      const code = `cb-list-${Date.now()}-${Math.random()}`
      await cb.saveCode(code)
      const codes = await cb.listCodes()
      expect(codes.some((c) => c.code === code)).toBe(true)
      expect(cb.state).toBe('closed')
    })
  })

  describe('Valkey goes down mid-run', () => {
    let primary: ValkeyKv
    let cb: CircuitBreakerKv
    // Use threshold=3 to match the real default and verify step-by-step tripping
    const THRESHOLD = 3

    beforeAll(async () => {
      primary = await ValkeyKv.connect(VALKEY_URL)
      cb = new CircuitBreakerKv(primary, new MemoryKv(), THRESHOLD, 5_000)
    })

    afterEach(() => {
      // Nothing to clean up per-test; the cb is shared
    })

    afterAll(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (cb) await cb.close()
    })

    it('falls back gracefully after the Valkey connection is closed', async () => {
      // 1. Verify normal operation
      const codeBefore = `cb-before-${Date.now()}-${Math.random()}`
      const r1 = await cb.saveCode(codeBefore)
      expect(r1.stored).toBe(true)
      expect(cb.state).toBe('closed')

      // 2. Simulate Valkey going down by closing the underlying connection
      await primary.close()

      // 3. Next THRESHOLD operations each fail on the (now-closed) primary,
      //    but the circuit breaker catches the error and falls back to memory.
      //    Every individual call must still succeed from the caller's perspective.
      for (let i = 1; i <= THRESHOLD; i++) {
        const code = `cb-after-${i}-${Date.now()}`
        const result = await cb.saveCode(code)
        expect(result.stored).toBe(true)
      }

      // 4. The circuit must now be open
      expect(cb.state).toBe('open')

      // 5. Subsequent calls bypass the primary entirely and read from the fallback
      const codes = await cb.listCodes()
      // The in-memory fallback holds only codes saved via fallback (steps 3+)
      expect(codes.length).toBeGreaterThanOrEqual(THRESHOLD)
    })

    it('circuit stays open for subsequent calls after tripping', async () => {
      // Circuit is already open from the previous test; additional calls
      // must go straight to fallback without attempting the primary.
      const codeExtra = `cb-open-extra-${Date.now()}`
      const result = await cb.saveCode(codeExtra)
      expect(result.stored).toBe(true)
      expect(cb.state).toBe('open')
    })
  })
})
