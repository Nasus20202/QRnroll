import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
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
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [currentDeviceIndex, setCurrentDeviceIndex] = useState(0)
  const currentDeviceIndexRef = useRef(0)

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

  const startDecoding = useCallback(
    async (deviceId?: string) => {
      if (!videoRef.current) {
        videoRef.current = document.createElement('video')
      }

      // Stop all existing tracks first so the camera hardware is fully released
      // before we ask for a new stream. Without this, Android throws
      // "could not start video source" when switching cameras.
      const existing = videoRef.current.srcObject
      const hadStream =
        existing != null &&
        typeof (existing as MediaStream).getTracks === 'function'
      if (hadStream) {
        ;(existing as MediaStream).getTracks().forEach((t) => t.stop())
      }
      videoRef.current.srcObject = null

      // Android needs a brief moment after tracks are stopped before the
      // hardware is actually available for a new stream. Only wait when we
      // actually stopped an existing stream.
      if (hadStream) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      const resetFn = (reader as unknown as { reset?: () => void }).reset
      if (typeof resetFn === 'function') resetFn.call(reader)

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
    },
    [handleScan, reader],
  )

  const switchCamera = useCallback(async () => {
    if (!devices.length) return

    const nextIndex = (currentDeviceIndexRef.current + 1) % devices.length
    currentDeviceIndexRef.current = nextIndex
    setCurrentDeviceIndex(nextIndex)

    try {
      await startDecoding(devices[nextIndex].deviceId || undefined)
      setTimedStatus({ kind: 'info', message: 'Switched camera' })
    } catch (err) {
      console.error('Camera switch error:', err)
      setTimedStatus({ kind: 'error', message: 'Unable to switch camera' }, 0)
    }
  }, [devices, setTimedStatus, startDecoding])

  useEffect(() => {
    const init = async () => {
      try {
        // Request permission preferring the rear camera, and capture which
        // deviceId the browser picked so we can start on the right one.
        const permStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        })
        const envDeviceId =
          permStream.getVideoTracks()[0]?.getSettings().deviceId ?? ''
        // Release immediately; startDecoding will open its own stream.
        permStream.getTracks().forEach((t) => t.stop())

        const allDevices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = allDevices.filter((d) => d.kind === 'videoinput')

        if (videoDevices.length === 0) {
          setTimedStatus({ kind: 'error', message: 'No camera found' }, 0)
          return
        }

        setDevices(videoDevices)

        // Pick the device the browser chose for 'environment', fall back to
        // a label search, then to index 0.
        let startIndex = envDeviceId
          ? videoDevices.findIndex((d) => d.deviceId === envDeviceId)
          : -1
        if (startIndex < 0)
          startIndex = videoDevices.findIndex((d) =>
            /back|rear|environment/i.test(d.label),
          )
        if (startIndex < 0) startIndex = 0

        currentDeviceIndexRef.current = startIndex
        setCurrentDeviceIndex(startIndex)

        // Use || instead of ?? to also catch empty-string deviceIds
        const deviceId = videoDevices[startIndex].deviceId || undefined

        await startDecoding(deviceId)
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
        onSwitchCamera={devices.length > 1 ? switchCamera : undefined}
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
