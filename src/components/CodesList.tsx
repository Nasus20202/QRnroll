import { useEffect, useState } from 'react'

import { Copy } from 'lucide-react'
import { differenceInSeconds } from 'date-fns'

import type { CodeItem } from '@/pages/ScannerPage'

export type CodesListProps = {
  codes: CodeItem[]
  onCopy: (code: string) => Promise<void>
  onRefresh: () => void
  onOpen: (code: string) => void
}

export function CodesList({
  codes,
  onCopy,
  onRefresh,
  onOpen,
}: CodesListProps) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [])

  return (
    <aside className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-xl">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
            Live list
          </p>
          <h2 className="text-lg font-semibold text-white">Active codes</h2>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="text-sm px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
        {codes.length === 0 && (
          <p className="text-slate-400 text-sm">No active codes yet.</p>
        )}
        {codes.map((item) => (
          <div
            key={`${item.code}-${item.ts}`}
            className="group border border-slate-700 rounded-lg p-3 bg-slate-900/70 hover:border-emerald-400/60 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => onOpen(item.code)}
                className="text-left w-full"
              >
                <p className="text-sm font-medium text-white truncate group-hover:text-emerald-200">
                  {item.code}
                </p>
                <p className="text-xs text-slate-400">
                  {Math.max(0, differenceInSeconds(now ?? item.ts, item.ts))}s
                  ago
                </p>
              </button>
            </div>
            <button
              type="button"
              onClick={() => onCopy(item.code)}
              className="opacity-70 group-hover:opacity-100 text-slate-300 hover:text-emerald-200"
              aria-label="Copy code"
            >
              <Copy size={16} />
            </button>
          </div>
        ))}
      </div>

      <a
        className="mt-4 inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200 text-sm"
        href="/enroll"
      >
        Click here to enroll automatically
      </a>
    </aside>
  )
}
