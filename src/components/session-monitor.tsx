'use client'

import { useEffect, useRef } from 'react'
import { useAuthStore } from '@/store/stores/auth.store'
import { onSessionExpired } from '@/lib/session'
import type { SyncEventDetail } from '@/lib/sync-service'

const CHECK_INTERVAL_MS = 5 * 60 * 1000

export function SessionMonitor() {
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    const redirect = () => {
      useAuthStore.getState().logout()
      if (window.location.pathname !== '/') {
        window.location.href = '/'
      }
    }

    const unsubSessionExpired = onSessionExpired(redirect)

    const handleSyncEvent = (event: CustomEvent<SyncEventDetail>) => {
      if (event.detail?.type === 'sync-error') {
        const hasAuthError = event.detail?.result?.errors?.some(e => e.error.includes('401') || e.error.includes('403'))
        if (hasAuthError) redirect()
      }
    }
    window.addEventListener('sync-event', handleSyncEvent as EventListener)

    const checkSession = async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' })
        if (!res.ok) {
          redirect()
        }
      } catch {
        redirect()
      }
    }

    timerRef.current = setInterval(checkSession, CHECK_INTERVAL_MS)

    return () => {
      unsubSessionExpired()
      window.removeEventListener('sync-event', handleSyncEvent as EventListener)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  return null
}
