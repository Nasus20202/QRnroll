import { useEffect, useState } from 'react'

import { getTrackingScript } from '@/server/tracking'
import type { TrackingScriptPayload } from '@/server/tracking'

export function TrackingScript() {
  const [script, setScript] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const loadScript = async () => {
      try {
        const result = await getTrackingScript()
        const payload: TrackingScriptPayload =
          result instanceof Response ? await result.json() : result

        if (mounted) {
          setScript(payload.script ?? null)
        }
      } catch (error) {
        console.error('Failed to fetch tracking script', error)
      }
    }

    void loadScript()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!script?.trim()) return
    if (typeof document === 'undefined') return

    const scriptString = script.trim()
    const cleanupFns: Array<() => void> = []

    const createAndAppend = (builder: () => HTMLScriptElement | null) => {
      const node = builder()
      if (!node) return
      document.head.appendChild(node)
      cleanupFns.push(() => {
        if (node.parentNode === document.head) {
          document.head.removeChild(node)
        }
      })
    }

    if (scriptString.startsWith('<script')) {
      createAndAppend(() => {
        const template = document.createElement('template')
        template.innerHTML = scriptString
        const parsed = template.content.querySelector('script')
        if (!parsed) return null

        const node = document.createElement('script')
        parsed.getAttributeNames().forEach((attr) => {
          const value = parsed.getAttribute(attr)
          if (attr === 'defer') {
            node.defer = true
          } else if (attr === 'async') {
            node.async = true
          } else if (value != null) {
            node.setAttribute(attr, value)
          } else {
            node.setAttribute(attr, '')
          }
        })

        if (parsed.textContent) {
          node.textContent = parsed.textContent
        }

        return node
      })
    } else {
      createAndAppend(() => {
        const node = document.createElement('script')
        node.textContent = scriptString
        return node
      })
    }

    return () => {
      cleanupFns.forEach((fn) => fn())
    }
  }, [script])

  return null
}
