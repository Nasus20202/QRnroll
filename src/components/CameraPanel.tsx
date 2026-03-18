import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Minus,
  Plus,
  ScanLine,
  SwitchCamera,
} from 'lucide-react'
import * as Slider from '@radix-ui/react-slider'
import type { RefObject } from 'react'
import { calcZoomStep, clampZoom } from '@/lib/scanner'
import type { Status, ZoomRange } from '@/lib/scanner'

export type CameraPanelProps = {
  videoRef: RefObject<HTMLVideoElement | null>
  onSwitchCamera?: () => void
  scanned: string | null
  status: Status
  zoom: number
  zoomRange: ZoomRange
  onZoomChange: (zoom: number) => void
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
  zoom,
  zoomRange,
  onZoomChange,
}: CameraPanelProps) {
  return (
    <div className="space-y-3">
      {onSwitchCamera && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSwitchCamera}
            aria-label="Switch camera"
            className="px-3 py-2 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700"
          >
            <SwitchCamera size={16} className="text-white" />
            <span className="sr-only">Switch camera</span>
          </button>
        </div>
      )}

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

      <div className="flex items-center gap-3 px-1" aria-label="Zoom control">
        <button
          type="button"
          onClick={() => {
            onZoomChange(clampZoom(zoom - calcZoomStep(zoomRange), zoomRange))
          }}
          aria-label="Zoom out"
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700"
        >
          <Minus size={14} className="text-white" />
        </button>
        <Slider.Root
          value={[zoom]}
          onValueChange={(value) => onZoomChange(value[0] ?? zoom)}
          min={zoomRange.min}
          max={zoomRange.max}
          step={zoomRange.step}
          className="relative flex items-center select-none touch-none flex-1 h-5"
          aria-label="Zoom"
        >
          <Slider.Track className="bg-slate-700 relative grow rounded-full h-1">
            <Slider.Range className="absolute bg-emerald-400 rounded-full h-full" />
          </Slider.Track>
          <Slider.Thumb
            className="block w-4 h-4 bg-white rounded-full shadow-sm focus:outline-none cursor-pointer"
            aria-label="Zoom level"
          />
        </Slider.Root>
        <button
          type="button"
          onClick={() => {
            onZoomChange(clampZoom(zoom + calcZoomStep(zoomRange), zoomRange))
          }}
          aria-label="Zoom in"
          className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700"
        >
          <Plus size={14} className="text-white" />
        </button>
        <span
          className="text-xs text-slate-400 w-9 text-right tabular-nums"
          aria-label="Current zoom"
        >
          {zoom.toFixed(1)}×
        </span>
      </div>

      <div className="flex items-center gap-3 text-sm text-slate-200">
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
