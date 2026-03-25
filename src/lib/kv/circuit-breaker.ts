import type { KvBackend } from '@/lib/kv'

export type CircuitState = 'closed' | 'open' | 'half-open'

export const DEFAULT_THRESHOLD = 3
export const DEFAULT_RECOVERY_MS = 30_000

/**
 * A KV backend wrapper that implements the circuit-breaker pattern.
 *
 * - **closed**: All operations go to the primary backend.
 * - **open**: All operations go to the fallback backend (in-memory).
 *   After `recoveryMs` the breaker transitions to half-open.
 * - **half-open**: The next operation probes the primary.
 *   Success → closed.  Failure → open (timer resets).
 *
 * The breaker opens after `threshold` consecutive failures on the primary.
 */
export class CircuitBreakerKv implements KvBackend {
  private _state: CircuitState = 'closed'
  private _failures = 0
  private openedAt = 0

  constructor(
    private readonly primary: KvBackend,
    private readonly fallback: KvBackend,
    readonly threshold: number = DEFAULT_THRESHOLD,
    readonly recoveryMs: number = DEFAULT_RECOVERY_MS,
  ) {}

  get state(): CircuitState {
    return this._state
  }

  get failures(): number {
    return this._failures
  }

  /** Returns true when the circuit is open and the recovery window has NOT elapsed. */
  private useFallback(): boolean {
    if (this._state === 'open') {
      if (Date.now() - this.openedAt >= this.recoveryMs) {
        this._state = 'half-open'
        console.log('[circuit-breaker] half-open: probing primary backend')
        return false
      }
      return true
    }
    return false
  }

  private onSuccess(): void {
    if (this._state === 'half-open') {
      console.log('[circuit-breaker] closed: primary backend recovered')
    }
    this._state = 'closed'
    this._failures = 0
  }

  private onFailure(err: unknown, operation: string): void {
    this._failures++
    const message = err instanceof Error ? err.message : String(err)
    console.error(
      `[circuit-breaker] primary error on ${operation} (failure ${this._failures}/${this.threshold}): ${message}`,
    )
    if (this._state === 'half-open' || this._failures >= this.threshold) {
      const alreadyOpen = this._state === 'open'
      this._state = 'open'
      this.openedAt = Date.now()
      if (!alreadyOpen) {
        console.error(
          '[circuit-breaker] open: primary backend unavailable, switching to in-memory fallback',
        )
      }
    }
  }

  async saveCode(code: string) {
    if (this.useFallback()) return this.fallback.saveCode(code)
    try {
      const result = await this.primary.saveCode(code)
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure(err, 'saveCode')
      return this.fallback.saveCode(code)
    }
  }

  async listCodes() {
    if (this.useFallback()) return this.fallback.listCodes()
    try {
      const result = await this.primary.listCodes()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure(err, 'listCodes')
      return this.fallback.listCodes()
    }
  }

  async getLatest() {
    if (this.useFallback()) return this.fallback.getLatest()
    try {
      const result = await this.primary.getLatest()
      this.onSuccess()
      return result
    } catch (err) {
      this.onFailure(err, 'getLatest')
      return this.fallback.getLatest()
    }
  }

  async close() {
    await this.primary.close()
    await this.fallback.close()
  }
}
