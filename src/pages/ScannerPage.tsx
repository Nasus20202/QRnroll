import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
// BrowserMultiFormatReader is used for the instance (decodeFromVideoDevice) only;
// device enumeration uses navigator.mediaDevices.enumerateDevices() directly.
import { CameraPanel } from '@/components/CameraPanel'
import { CodesList } from '@/components/CodesList'

export type SubmitResult = {
  ok: boolean
  stored?: boolean
  reason?: string
  ts?: number | null
}

export type CodeItem = { code: string; ts: number }

export type ScannerPageProps = {
  submitCode: (code: string) => Promise<SubmitResult>
  fetchCodes: () => Promise<CodeItem[]>
}

export type StatusKind = 'idle' | 'submitting' | 'success' | 'error' | 'info'

export type Status = {
  kind: StatusKind
  message: string
}

const IDLE_STATUS: Status = { kind: 'idle', message: '' }
const SCAN_COOLDOWN_MS = 2000

export default function ScannerPage({
  submitCode,
  fetchCodes,
}: ScannerPageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scanLock = useRef(false)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [scanned, setScanned] = useState<string | null>(null)
  const [codes, setCodes] = useState<CodeItem[]>([])
  const [status, setStatus] = useState<Status>(IDLE_STATUS)

  const reader = useMemo(() => new BrowserMultiFormatReader(), [])

  const setTimedStatus = useCallback((next: Status, ms = 3000) => {
    if (statusTimer.current) clearTimeout(statusTimer.current)
    setStatus(next)
    if (ms > 0) {
      statusTimer.current = setTimeout(() => setStatus(IDLE_STATUS), ms)
    } else {
      statusTimer.current = null
    }
  }, [])

  const refreshCodes = useCallback(async () => {
    try {
      const list = await fetchCodes()
      setCodes(list)
    } catch (err) {
      console.error('Failed to fetch codes:', err)
      setTimedStatus({ kind: 'error', message: 'Failed to refresh list' })
    }
  }, [fetchCodes, setTimedStatus])

  const handleScan = useCallback(
    async (code: string) => {
      if (!code || scanLock.current) return
      scanLock.current = true
      setScanned(code)
      setStatus({ kind: 'submitting', message: 'Submitting…' })

      try {
        const payload = await submitCode(code)
        if (payload.ok) {
          setTimedStatus(
            {
              kind: 'success',
              message: payload.stored ? 'Saved' : 'Duplicate (ignored)',
            },
            0,
          )
          await refreshCodes()
        } else {
          setTimedStatus({
            kind: 'error',
            message: `Submit failed${payload.reason ? `: ${payload.reason}` : ''}`,
          })
        }
      } catch (err) {
        console.error('Error submitting code:', err)
        setTimedStatus({ kind: 'error', message: 'Error submitting code' })
      } finally {
        setTimeout(() => {
          scanLock.current = false
        }, SCAN_COOLDOWN_MS)
      }
    },
    [submitCode, refreshCodes, setTimedStatus],
  )

  useEffect(() => {
    const init = async () => {
      try {
        // Request permission first so that enumerateDevices returns real device IDs.
        // Without this, browsers return empty-string deviceIds until permission is granted,
        // causing OverconstrainedError when a blank/fake ID is passed as an exact constraint.
        await navigator.mediaDevices.getUserMedia({ video: true })

        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const devices = allDevices.filter((d) => d.kind === 'videoinput')

        if (devices.length === 0) {
          setTimedStatus({ kind: 'error', message: 'No camera found' }, 0)
          return
        }

        // Use || instead of ?? to also catch empty-string deviceIds
        const deviceId = devices[0].deviceId || undefined

        if (!videoRef.current) {
          videoRef.current = document.createElement('video')
        }

        await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, err) => {
            if (result) {
              handleScan(result.getText())
            }
            if (err && !err.name.startsWith('NotFoundException')) {
              console.error('Decode error:', err)
            }
          },
        )
      } catch (err) {
        console.error('Camera init error:', err)
        const message =
          err instanceof DOMException && err.name === 'NotAllowedError'
            ? 'Camera permission denied'
            : 'Camera unavailable — check permissions'
        setTimedStatus({ kind: 'error', message }, 0)
      }
    }

    void init()

    return () => {
      const resetFn = (reader as unknown as { reset?: () => void }).reset
      if (typeof resetFn === 'function') resetFn.call(reader)
      if (statusTimer.current) clearTimeout(statusTimer.current)
    }
  }, [reader, handleScan, setTimedStatus])

  useEffect(() => {
    void refreshCodes()
    const id = setInterval(() => void refreshCodes(), 1000)
    return () => clearInterval(id)
  }, [refreshCodes])

  const [zoom, setZoom] = useState<number>(1)

  const handleZoom = useCallback(
    (delta: number) => {
      const next = Math.min(3, Math.max(1, zoom + delta))
      setZoom(next)
      if (videoRef.current) {
        videoRef.current.style.transform = `scale(${next})`
      }
    },
    [zoom],
  )

  const copyCode = useCallback(
    async (code: string) => {
      try {
        await navigator.clipboard.writeText(code)
        setTimedStatus({ kind: 'success', message: 'Copied' })
      } catch (err) {
        console.error('Clipboard error:', err)
        setTimedStatus({ kind: 'error', message: 'Failed to copy' })
      }
    },
    [setTimedStatus],
  )

  const openCode = useCallback((code: string) => {
    window.open(code, '_blank', 'noopener,noreferrer')
  }, [])

  return (
    <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
      <CameraPanel
        videoRef={videoRef}
        onZoom={handleZoom}
        scanned={scanned}
        status={status}
      />
      <CodesList
        codes={codes}
        onCopy={copyCode}
        onRefresh={() => void refreshCodes()}
        onOpen={openCode}
      />
    </div>
  )
}
