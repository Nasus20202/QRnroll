import { useEffect, useMemo, useRef, useState } from 'react'
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

export default function ScannerPage({
  submitCode,
  fetchCodes,
}: ScannerPageProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [scanned, setScanned] = useState<string | null>(null)
  const [codes, setCodes] = useState<CodeItem[]>([])
  const [status, setStatus] = useState<string>('')
  const [zoom, setZoom] = useState<number>(1)

  const reader = useMemo(() => new BrowserMultiFormatReader(), [])

  useEffect(() => {
    const init = async () => {
      try {
        const devices =
          (await BrowserMultiFormatReader.listVideoInputDevices()) ?? []
        if (!devices.length) return
        const deviceId = devices[0].deviceId
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
            const name = err?.name
            if (name && name.startsWith('NotFoundException')) {
              return
            }
            if (err) {
              console.error(err)
            }
          },
        )
      } catch (err) {
        const name = (err as Error | undefined)?.name
        if (name && name.startsWith('NotFoundException')) {
          setStatus('No code detected yet')
          return
        }
        console.error(err)
        setStatus('Camera unavailable')
      }
    }
    void init()
    return () => {
      const resetFn = (reader as unknown as { reset?: () => void }).reset
      if (typeof resetFn === 'function') resetFn.call(reader)
    }
  }, [reader])

  const handleScan = async (code: string) => {
    if (!code) return
    setScanned(code)
    setStatus('Submitting…')
    try {
      const payload = await submitCode(code)
      if (payload.ok) {
        setStatus(payload.stored ? 'Saved' : 'Duplicate (ignored)')
        await refreshCodes()
      } else {
        setStatus('Submit failed')
      }
    } catch (err) {
      console.error(err)
      setStatus('Error submitting')
    }
  }

  const refreshCodes = async () => {
    const list = await fetchCodes()
    setCodes(list)
  }

  useEffect(() => {
    void refreshCodes()
    const id = setInterval(() => void refreshCodes(), 1000)
    return () => clearInterval(id)
  }, [])

  const handleZoom = (delta: number) => {
    const next = Math.min(3, Math.max(1, zoom + delta))
    setZoom(next)
    if (videoRef.current) {
      videoRef.current.style.transform = `scale(${next})`
    }
  }

  const copyCode = async (code: string) => {
    await navigator.clipboard.writeText(code)
    setStatus('Copied')
  }

  const openCode = (code: string) => {
    window.open(code, '_blank', 'noopener,noreferrer')
  }

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
