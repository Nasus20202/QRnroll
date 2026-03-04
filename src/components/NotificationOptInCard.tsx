type NotificationOptInCardProps = {
  permission: NotificationPermission
  onRequest: () => void
}

export function NotificationOptInCard({
  permission,
  onRequest,
}: NotificationOptInCardProps) {
  return (
    <div className="mt-4 border border-slate-700 bg-slate-900/70 rounded-xl p-4 text-sm text-slate-200">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <p className="text-white font-medium">Browser notifications</p>
          <p className="text-xs text-slate-400">
            Get alerted even if this tab is hidden.
          </p>
        </div>
        {permission === 'granted' ? (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40">
            Enabled
          </span>
        ) : (
          <button
            type="button"
            onClick={onRequest}
            className="text-xs px-3 py-1 rounded-full border border-slate-600 bg-slate-800 hover:bg-slate-700 text-emerald-200"
          >
            Enable notifications
          </button>
        )}
      </div>
      {permission === 'denied' && (
        <p className="text-xs text-amber-300 mt-2">
          Permission blocked — allow notifications from your browser settings.
        </p>
      )}
    </div>
  )
}
