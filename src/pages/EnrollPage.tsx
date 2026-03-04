import { useCallback, useEffect, useRef, useState } from 'react'

import { CodesList } from '@/components/CodesList'
import { LiveStatus } from '@/components/LiveStatus'
import { NotificationOptInCard } from '@/components/NotificationOptInCard'
import { PageHero } from '@/components/PageHero'
import type { CodesResponse } from '@/server/codes'

export type EnrollPageProps = {
  fetchCodes: () => Promise<CodesResponse>
}

function useLiveCodes(
  fetchCodes: () => Promise<CodesResponse>,
  onNewCodes?: (items: CodesResponse) => void,
) {
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
        const newlyOpened: CodesResponse = []
        for (const item of list) {
          if (!openedRef.current.has(item.code)) {
            openedRef.current.add(item.code)
            setLastOpened(item.code)
            setStatus(`Opening ${item.code}…`)
            window.open(item.code, '_blank', 'noopener,noreferrer')
            openedAny = true
            newlyOpened.push(item)
          }
        }
        if (newlyOpened.length && onNewCodes) {
          onNewCodes(newlyOpened)
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
  }, [fetchCodes, onNewCodes])

  return { codes, status, lastOpened }
}

export default function EnrollPage({ fetchCodes }: EnrollPageProps) {
  const [supportsNotifications, setSupportsNotifications] = useState(false)
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setSupportsNotifications(false)
      return
    }
    setSupportsNotifications(true)
    setNotificationPermission(Notification.permission)
  }, [])

  const notifyNewCodes = useCallback(
    (items: CodesResponse) => {
      if (!supportsNotifications || notificationPermission !== 'granted') {
        return
      }
      for (const item of items) {
        try {
          new Notification('New code available', {
            body: item.code,
            tag: item.code,
            icon: '/favicon.ico',
          })
        } catch (err) {
          console.error('Notification error:', err)
        }
      }
    },
    [notificationPermission, supportsNotifications],
  )

  const requestNotifications = useCallback(async () => {
    if (!supportsNotifications || notificationPermission === 'granted') {
      return
    }
    try {
      const result = await Notification.requestPermission()
      setNotificationPermission(result)
    } catch (err) {
      console.error('Notification permission error:', err)
    }
  }, [notificationPermission, supportsNotifications])

  const { codes, status, lastOpened } = useLiveCodes(fetchCodes, notifyNewCodes)

  useEffect(() => {
    if (!supportsNotifications || notificationPermission !== 'default') {
      return
    }
    void requestNotifications()
  }, [notificationPermission, requestNotifications, supportsNotifications])

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
      <PageHero
        eyebrow={{ label: 'QRnroll', href: '/' }}
        title="Enroll redirect"
        description={
          <p>
            This page watches for valid codes and opens each one in a new tab as
            soon as it appears. Keep this tab open. Please allow popups for this
            site, and make sure your browser is not blocking them.
          </p>
        }
      >
        <LiveStatus status={status} lastOpened={lastOpened} />
        {supportsNotifications && (
          <NotificationOptInCard
            permission={notificationPermission}
            onRequest={requestNotifications}
          />
        )}
      </PageHero>

      <div className="space-y-3">
        <CodesList
          codes={codes}
          onCopy={handleCopy}
          onRefresh={handleRefresh}
          onOpen={handleOpen}
          showAutoEnrollCta={false}
        />
      </div>
    </div>
  )
}
