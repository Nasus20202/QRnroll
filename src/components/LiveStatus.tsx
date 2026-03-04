type LiveStatusProps = {
  status: string
  lastOpened: string | null
}

export function LiveStatus({ status, lastOpened }: LiveStatusProps) {
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
