import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/enroll/test')({
  component: EnrollTestPage,
})

function EnrollTestPage() {
  const [status, setStatus] = useState<string>(
    'Awaiting your click to open a test tab…',
  )

  const openTestTab = () => {
    const win = window.open('about:blank', '_blank', 'noopener,noreferrer')
    if (win) {
      win.document.write(
        '<title>QRnroll test tab</title><h1>Pop-up allowed</h1>',
      )
      setStatus('Test tab opened successfully. Pop-ups are allowed.')
    } else {
      setStatus('Blocked. Please allow pop-ups for this site and try again.')
    }
  }

  return (
    <div className="max-w-3xl mx-auto bg-slate-800/80 border border-slate-700 rounded-2xl p-5 shadow-xl space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">
          QRnroll
        </p>
        <h1 className="text-2xl font-semibold text-white">Pop-up test</h1>
        <p className="text-slate-300 text-sm">
          Click the button to open a harmless test tab. If it is blocked, allow
          pop-ups for this site, then return and try again.
        </p>
      </div>
      <button
        type="button"
        onClick={openTestTab}
        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm text-slate-100"
      >
        Open test tab
      </button>
      <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-4 text-slate-200 text-sm">
        Status: {status}
      </div>
    </div>
  )
}
