import { describe, expect, it } from 'vitest'
import {
  IDLE_STATUS,
  SCAN_COOLDOWN_MS,
  SOFTWARE_ZOOM_RANGE,
  calcZoomStep,
  clampZoom,
} from '@/lib/scanner'

describe('calcZoomStep', () => {
  it('returns one tenth of the range span', () => {
    expect(calcZoomStep({ min: 1, max: 5, step: 0.1 })).toBeCloseTo(0.4)
  })

  it('works for a hardware zoom range', () => {
    expect(calcZoomStep({ min: 1, max: 3, step: 0.5 })).toBeCloseTo(0.2)
  })
})

describe('clampZoom', () => {
  const range = { min: 1, max: 5, step: 0.1 }

  it('returns value unchanged when within range', () => {
    expect(clampZoom(3, range)).toBe(3)
  })

  it('clamps to min when value is below range', () => {
    expect(clampZoom(0.5, range)).toBe(1)
  })

  it('clamps to max when value is above range', () => {
    expect(clampZoom(7, range)).toBe(5)
  })

  it('allows value exactly at min', () => {
    expect(clampZoom(1, range)).toBe(1)
  })

  it('allows value exactly at max', () => {
    expect(clampZoom(5, range)).toBe(5)
  })
})

describe('constants', () => {
  it('IDLE_STATUS has kind idle and empty message', () => {
    expect(IDLE_STATUS).toEqual({ kind: 'idle', message: '' })
  })

  it('SCAN_COOLDOWN_MS is a positive number', () => {
    expect(SCAN_COOLDOWN_MS).toBeGreaterThan(0)
  })

  it('SOFTWARE_ZOOM_RANGE spans 1–5 with step 0.1', () => {
    expect(SOFTWARE_ZOOM_RANGE).toEqual({ min: 1, max: 5, step: 0.1 })
  })
})
