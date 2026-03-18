import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import type {
  CodeItem,
  Status,
  StatusKind,
  SubmitResult,
  ZoomRange,
} from '@/lib/scanner'
import { CameraPanel } from '@/components/CameraPanel'
import { CodesList } from '@/components/CodesList'
import { PageHero } from '@/components/PageHero'
import { pickRearDeviceIndex } from '@/lib/camera'
import {
  IDLE_STATUS,
  SCAN_COOLDOWN_MS,
  SOFTWARE_ZOOM_RANGE,
} from '@/lib/scanner'

export type { CodeItem, Status, StatusKind, SubmitResult, ZoomRange }

export type ScannerPageProps = {
  submitCode: (code: string) => Promise<SubmitResult>
  fetchCodes: () => Promise<Array<CodeItem>>
}

export default function ScannerPage({
  submitCode,
  fetchCodes,
}: ScannerPageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scanLock = useRef(false)
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Software-zoom canvas pipeline refs
  const srcVideoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawLoopRef = useRef<number | null>(null)
  const softwareZoomRef = useRef(1)
  const zoomModeRef = useRef<'hardware' | 'software' | null>(null)

  const [scanned, setScanned] = useState<string | null>(null)
  const [codes, setCodes] = useState<Array<CodeItem>>([])
  const [status, setStatus] = useState<Status>(IDLE_STATUS)
  const [devices, setDevices] = useState<Array<MediaDeviceInfo>>([])
  const currentDeviceIndexRef = useRef(0)
  const [zoom, setZoom] = useState(1)
  const [zoomRange, setZoomRange] = useState<ZoomRange>(SOFTWARE_ZOOM_RANGE)

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

  const stopDrawLoop = useCallback(() => {
    if (drawLoopRef.current !== null) {
      cancelAnimationFrame(drawLoopRef.current)
      drawLoopRef.current = null
    }
  }, [])

  // Draws the current software-zoom crop from srcVideo onto the canvas.
  // The canvas stream is fed to ZXing so the reader genuinely sees the
  // cropped (zoomed-in) region, not just a CSS visual effect.
  const startDrawLoop = useCallback(
    (srcVideo: HTMLVideoElement, canvas: HTMLCanvasElement) => {
      const draw = () => {
        const { videoWidth: w, videoHeight: h } = srcVideo
        if (w > 0 && h > 0) {
          if (canvas.width !== w) canvas.width = w
          if (canvas.height !== h) canvas.height = h
          const ctx = canvas.getContext('2d')
          if (ctx) {
            const z = softwareZoomRef.current
            const cropW = w / z
            const cropH = h / z
            const offsetX = (w - cropW) / 2
            const offsetY = (h - cropH) / 2
            ctx.drawImage(srcVideo, offsetX, offsetY, cropW, cropH, 0, 0, w, h)
          }
        }
        drawLoopRef.current = requestAnimationFrame(draw)
      }
      drawLoopRef.current = requestAnimationFrame(draw)
    },
    [],
  )

  const applyZoom = useCallback(async (newZoom: number) => {
    if (zoomModeRef.current === 'hardware') {
      const srcObj = videoRef.current?.srcObject
      if (
        srcObj &&
        typeof (srcObj as { getVideoTracks?: unknown }).getVideoTracks ===
          'function'
      ) {
        const track = (srcObj as MediaStream).getVideoTracks()[0]
        try {
          await track.applyConstraints({
            advanced: [{ zoom: newZoom } as unknown as MediaTrackConstraintSet],
          })
        } catch (err) {
          console.error('Zoom error:', err)
          return
        }
      }
    } else {
      // Software zoom: update the crop factor consumed by the draw loop
      softwareZoomRef.current = newZoom
    }
    setZoom(newZoom)
  }, [])

  const startDecoding = useCallback(
    async (deviceId?: string) => {
      if (!videoRef.current) {
        videoRef.current = document.createElement('video')
      }

      // Tear down any existing pipeline
      stopDrawLoop()

      const existingDisplay = videoRef.current.srcObject
      const hadDisplayStream =
        existingDisplay != null &&
        typeof (existingDisplay as MediaStream).getTracks === 'function'
      if (hadDisplayStream) {
        ;(existingDisplay as MediaStream).getTracks().forEach((t) => t.stop())
      }
      videoRef.current.srcObject = null

      if (srcVideoRef.current) {
        const srcStream = srcVideoRef.current.srcObject as MediaStream | null
        srcStream?.getTracks().forEach((t) => t.stop())
        srcVideoRef.current.srcObject = null
        srcVideoRef.current = null
      }
      canvasRef.current = null

      // Android needs a brief moment after tracks are stopped before the
      // hardware is actually available for a new stream. Only wait when we
      // actually stopped an existing stream.
      if (hadDisplayStream) {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }

      const resetFn = (reader as unknown as { reset?: () => void }).reset
      if (typeof resetFn === 'function') resetFn.call(reader)

      // Open the raw camera stream ourselves so we can inspect zoom capability
      // before deciding which pipeline to start.
      const rawStream = await navigator.mediaDevices.getUserMedia({
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: { ideal: 'environment' } },
      })

      const rawTrack = rawStream.getVideoTracks()[0]
      const rawCaps = rawTrack.getCapabilities() as
        | (MediaTrackCapabilities & { zoom?: ZoomRange })
        | undefined

      if (rawCaps?.zoom) {
        // Hardware zoom available — feed the raw stream directly to ZXing.
        zoomModeRef.current = 'hardware'
        const rawSettings = rawTrack.getSettings() as MediaTrackSettings & {
          zoom?: number
        }
        setZoomRange({
          min: rawCaps.zoom.min,
          max: rawCaps.zoom.max,
          step: rawCaps.zoom.step,
        })
        setZoom(rawSettings.zoom ?? rawCaps.zoom.min)
        softwareZoomRef.current = 1

        await reader.decodeFromStream(
          rawStream,
          videoRef.current,
          (result, err) => {
            if (result) handleScan(result.getText())
            if (err && !err.name.startsWith('NotFoundException')) {
              console.error('Decode error:', err)
            }
          },
        )
      } else {
        // No hardware zoom — use a canvas crop pipeline so that the software
        // zoom level genuinely affects what ZXing reads (not just CSS visuals).
        zoomModeRef.current = 'software'
        softwareZoomRef.current = 1
        setZoom(1)
        setZoomRange(SOFTWARE_ZOOM_RANGE)

        // Source video receives the raw camera stream (not shown to the user).
        const srcVideo = document.createElement('video')
        srcVideo.muted = true
        srcVideo.playsInline = true
        srcVideo.autoplay = true
        srcVideo.srcObject = rawStream
        srcVideoRef.current = srcVideo
        try {
          await srcVideo.play()
        } catch {
          // play() is not supported in some environments (e.g. jsdom)
        }

        // Wait until the video has dimensions so the canvas is sized correctly.
        // Use a short fallback timeout so this doesn't stall in environments
        // (like jsdom) where loadedmetadata never fires.
        await new Promise<void>((resolve) => {
          if (srcVideo.videoWidth > 0) {
            resolve()
            return
          }
          const fallback = setTimeout(resolve, 0)
          srcVideo.addEventListener(
            'loadedmetadata',
            () => {
              clearTimeout(fallback)
              resolve()
            },
            { once: true },
          )
        })

        const canvas = document.createElement('canvas')
        canvas.width = srcVideo.videoWidth || 640
        canvas.height = srcVideo.videoHeight || 480
        canvasRef.current = canvas
        startDrawLoop(srcVideo, canvas)

        // The canvas stream is what ZXing reads — and what the <video> displays.
        const canvasStream = canvas.captureStream(30)
        await reader.decodeFromStream(
          canvasStream,
          videoRef.current,
          (result, err) => {
            if (result) handleScan(result.getText())
            if (err && !err.name.startsWith('NotFoundException')) {
              console.error('Decode error:', err)
            }
          },
        )
      }
    },
    [handleScan, reader, stopDrawLoop, startDrawLoop],
  )

  const switchCamera = useCallback(async () => {
    if (!devices.length) return

    const nextIndex = (currentDeviceIndexRef.current + 1) % devices.length
    currentDeviceIndexRef.current = nextIndex

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
        const startIndex = pickRearDeviceIndex(videoDevices, envDeviceId)

        currentDeviceIndexRef.current = startIndex

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
      stopDrawLoop()
      if (srcVideoRef.current) {
        const srcStream = srcVideoRef.current.srcObject as MediaStream | null
        srcStream?.getTracks().forEach((t) => t.stop())
      }
      const resetFn = (reader as unknown as { reset?: () => void }).reset
      if (typeof resetFn === 'function') resetFn.call(reader)
      if (statusTimer.current) clearTimeout(statusTimer.current)
    }
  }, [reader, handleScan, setTimedStatus, startDecoding, stopDrawLoop])

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
      <PageHero
        eyebrow={{ label: 'QRnroll', href: '/' }}
        title="Scan attendance code"
        description={
          <p>Aim at the room's QR code to submit attendance instantly.</p>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            {devices.length
              ? `${devices.length} camera${devices.length > 1 ? 's' : ''} detected`
              : 'Waiting for camera permission…'}
          </p>
          <CameraPanel
            videoRef={videoRef}
            onSwitchCamera={devices.length > 1 ? switchCamera : undefined}
            scanned={scanned}
            status={status}
            zoom={zoom}
            zoomRange={zoomRange}
            onZoomChange={applyZoom}
          />
        </div>
      </PageHero>
      <CodesList
        codes={codes}
        onCopy={copyCode}
        onRefresh={() => void refreshCodes()}
        onOpen={openCode}
      />
    </div>
  )
}
