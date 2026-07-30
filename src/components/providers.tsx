'use client'

import { ThemeProvider } from 'next-themes'
import { useEffect } from 'react'
import { initSyncService } from '@/lib/sync-service'
import { DynamicFavicon } from '@/components/dynamic-favicon'
import { GlobalSearch } from '@/components/ui/global-search'
import { Toaster } from '@/components/ui/sonner'
import { SessionMonitor } from '@/components/session-monitor'
import { QueryProvider } from '@/lib/react-query'
import { useConfigStore, useSearchStore } from '@/store'
import type { SystemConfig } from '@/types'

interface ProvidersProps {
  children: React.ReactNode
  initialConfig?: SystemConfig | null
}

export function Providers({ children, initialConfig }: ProvidersProps) {
  const setConfig = useConfigStore(s => s.setConfig)
  const searchOpen = useSearchStore(s => s.searchOpen)
  const setSearchOpen = useSearchStore(s => s.setSearchOpen)

  useEffect(() => {
    try { initSyncService() } catch { /* error de inicio no fatal */ }

    if (initialConfig) {
      setConfig(initialConfig)
    } else {
      const retry = (attempt: number) => {
        fetch('/api/config')
          .then(res => res.json())
          .then((data: { config: SystemConfig }) => {
            if (data.config) setConfig(data.config)
          })
          .catch((err) => {
            console.error('Error fetching config (attempt', attempt, '):', err)
            if (attempt < 3) setTimeout(() => retry(attempt + 1), 1000 * attempt)
          })
      }
      retry(1)
    }

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }

    document.documentElement.classList.remove('preload')
  }, [setConfig, initialConfig])

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <SessionMonitor />
        <DynamicFavicon />
        {children}
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        <Toaster />
      </QueryProvider>
    </ThemeProvider>
  )
}
