export type StatusKind = 'idle' | 'submitting' | 'success' | 'error' | 'info'

export type Status = {
  kind: StatusKind
  message: string
}

export type ZoomRange = { min: number; max: number; step: number }

export type SubmitResult = {
  ok: boolean
  stored?: boolean
  reason?: string
  ts?: number | null
}

export type CodeItem = { code: string; ts: number }

export const IDLE_STATUS: Status = { kind: 'idle', message: '' }
export const SCAN_COOLDOWN_MS = 2000
export const SOFTWARE_ZOOM_RANGE: ZoomRange = { min: 1, max: 5, step: 0.1 }

/** Calculates the step size for zoom +/- buttons (1/10th of the full range). */
export function calcZoomStep(range: ZoomRange): number {
  return (range.max - range.min) / 10
}

/** Clamps a zoom value to the valid [min, max] range. */
export function clampZoom(value: number, range: ZoomRange): number {
  return Math.min(range.max, Math.max(range.min, value))
}
