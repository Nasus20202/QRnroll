import { useEffect, useRef, useState } from 'react'

import { CodesList } from '@/components/CodesList'
import type { CodesResponse } from '@/server/codes'

export type EnrollPageProps = {
  fetchCodes: () => Promise<CodesResponse>
}

function useLiveCodes(fetchCodes: () => Promise<CodesResponse>) {
  const [codes, setCodes] = useState<CodesResponse>([])
  const [status, setStatus] = useState<string>('Waiting for valid codes…')
  const [lastOpened, setLastOpened] = useState<string | null>(null)
  const openedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    let mounted = true

    const tick = async () => {
      try {
        const list = await fetchCodes()
        if (!mounted) return
        setCodes(list)
        if (!list.length) {
          // Only reset to waiting if we have never opened a code yet; otherwise keep the
          // previous status so recent openings remain visible to the user (and tests).
          if (!openedRef.current.size) {
            setStatus('Waiting for valid codes…')
          }
          return
        }
        let openedAny = false
        for (const item of list) {
          if (!openedRef.current.has(item.code)) {
            openedRef.current.add(item.code)
            setLastOpened(item.code)
            setStatus(`Opening ${item.code}…`)
            window.open(item.code, '_blank', 'noopener,noreferrer')
            openedAny = true
          }
        }
        if (!openedAny) {
          setStatus('No new codes to open yet')
        }
      } catch (err) {
        console.error(err)
        if (!mounted) return
        setStatus('Error loading codes')
      }
    }

    void tick()
    const id = setInterval(tick, 500)
    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [fetchCodes])

  return { codes, status, lastOpened }
}

export default function EnrollPage({ fetchCodes }: EnrollPageProps) {
  const { codes, status, lastOpened } = useLiveCodes(fetchCodes)

  useEffect(() => {
    const newWindow = window.open('', '_blank')
    if (newWindow) {
      newWindow.close()
    }
  }, [])

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code)
  }

  const handleRefresh = async () => {
    await fetchCodes()
  }

  const handleOpen = (code: string) => {
    window.open(code, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-xl text-left space-y-3">
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
          QRnroll
        </p>
        <h1 className="text-2xl font-semibold text-white">Enroll redirect</h1>
        <p className="text-slate-300 text-sm">
          This page watches for valid codes and opens each one in a new tab as
          soon as it appears. Keep this tab open. Please allow popups for this
          site, and make sure your browser is not blocking them.
        </p>
        <LiveStatus status={status} lastOpened={lastOpened} />
      </div>

      <div className="space-y-3">
        <CodesList
          codes={codes}
          onCopy={handleCopy}
          onRefresh={handleRefresh}
          onOpen={handleOpen}
        />
      </div>
    </div>
  )
}

function LiveStatus({
  status,
  lastOpened,
}: {
  status: string
  lastOpened: string | null
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 text-slate-200 space-y-2">
      <p className="text-sm">Status: {status}</p>
      {lastOpened ? (
        <p className="text-xs text-slate-400 break-all">
          Last opened: {lastOpened}
        </p>
      ) : (
        <p className="text-xs text-slate-500">No codes opened yet</p>
      )}
    </div>
  )
}
