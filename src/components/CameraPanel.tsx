import { CheckCircle2, ScanLine, ZoomIn, ZoomOut } from 'lucide-react'
import type { RefObject } from 'react'

export type CameraPanelProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  onZoom: (delta: number) => void
  scanned: string | null
  status: string
}

export function CameraPanel({
  videoRef,
  onZoom,
  scanned,
  status,
}: CameraPanelProps) {
  return (
    <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-4 shadow-xl">
      <header className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
            QRnroll
          </p>
          <h1 className="text-2xl font-semibold text-white">
            Scan attendance code
          </h1>
          <p className="text-sm text-slate-300">
            Aim at the room’s QR. Zoom if it’s far.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onZoom(0.1)}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 flex items-center gap-1"
          >
            <ZoomIn size={16} />
          </button>
          <button
            type="button"
            onClick={() => onZoom(-0.1)}
            className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600"
          >
            <ZoomOut size={16} />
          </button>
        </div>
      </header>

      <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900/80">
        <video
          ref={videoRef}
          className="w-full h-full object-contain transition-transform bg-black"
          muted
          playsInline
          autoPlay
        />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <ScanLine className="text-emerald-300 w-24 h-24 opacity-70" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 text-sm text-slate-200">
        {scanned ? (
          <>
            <CheckCircle2 className="text-emerald-400" size={18} />
            <span className="truncate max-w-[60%]">{scanned}</span>
          </>
        ) : (
          <span className="text-slate-400">Waiting for scan…</span>
        )}
        <span className="ml-auto text-xs text-slate-400">{status}</span>
      </div>
    </div>
  )
}
