import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  ScanLine,
  SwitchCamera,
} from 'lucide-react'
import type { RefObject } from 'react'
import type { Status } from '@/pages/ScannerPage'

export type CameraPanelProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  onSwitchCamera?: () => void
  scanned: string | null
  status: Status
}

const statusStyles: Record<Status['kind'], string> = {
  idle: 'text-slate-400',
  submitting: 'text-slate-300',
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-sky-400',
}

const StatusIcon = ({ kind }: { kind: Status['kind'] }) => {
  switch (kind) {
    case 'submitting':
      return <Loader2 size={14} className="animate-spin text-slate-300" />
    case 'success':
      return <CheckCircle2 size={14} className="text-emerald-400" />
    case 'error':
      return <AlertCircle size={14} className="text-red-400" />
    case 'info':
      return <Info size={14} className="text-sky-400" />
    default:
      return null
  }
}

export function CameraPanel({
  videoRef,
  onSwitchCamera,
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
          <p className="text-sm text-slate-300">Aim at the room's QR code.</p>
        </div>
        <div className="flex gap-2">
          {onSwitchCamera && (
            <button
              type="button"
              onClick={onSwitchCamera}
              aria-label="Switch camera"
              className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600"
            >
              <SwitchCamera size={16} className="text-white" />
              <span className="sr-only">Switch camera</span>
            </button>
          )}
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
            <CheckCircle2 className="text-emerald-400 shrink-0" size={18} />
            <span className="truncate max-w-[60%]">{scanned}</span>
          </>
        ) : (
          <span className="text-slate-400">Waiting for scan…</span>
        )}

        {status.message && (
          <div
            className={`ml-auto flex items-center gap-1 text-xs ${statusStyles[status.kind]}`}
          >
            <StatusIcon kind={status.kind} />
            <span>{status.message}</span>
          </div>
        )}
      </div>
    </div>
  )
}
