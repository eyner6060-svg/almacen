'use client'

import { memo, useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/http'
import { Server, Database, Activity, Users, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface SystemHealth {
  dbStatus: 'healthy' | 'degraded' | 'down'
  cacheStatus: 'healthy' | 'degraded' | 'down'
  activeUsersToday: number
  apiCallsToday: number
  lastSyncTime: string | null
  uptime: string
}

export const WidgetSystemHealth = memo(function WidgetSystemHealth() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await apiFetch('/api/system/health')
        if (response.ok) {
          const data = await response.json()
          setHealth(data)
        }
      } catch {
        // silencioso
      } finally {
        setIsLoading(false)
      }
    }
    fetchHealth()
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    )
  }

  if (!health) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4 text-destructive" />
        No se pudo obtener el estado del sistema
      </div>
    )
  }

  const statusBadge = (status: SystemHealth['dbStatus']) => {
    const map = {
      healthy: { label: 'Saludable', variant: 'default' as const, icon: CheckCircle2, color: 'text-green-500' },
      degraded: { label: 'Degradado', variant: 'secondary' as const, icon: AlertCircle, color: 'text-amber-500' },
      down: { label: 'Caído', variant: 'destructive' as const, icon: AlertCircle, color: 'text-red-500' },
    }
    const s = map[status]
    const Icon = s.icon
    return (
      <Badge variant={s.variant} className="gap-1">
        <Icon className={cn("h-3 w-3", s.color)} />
        {s.label}
      </Badge>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-muted-foreground" />
          <span>Base de Datos</span>
        </div>
        {statusBadge(health.dbStatus)}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Server className="h-4 w-4 text-muted-foreground" />
          <span>Cache</span>
        </div>
        {statusBadge(health.cacheStatus)}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>Usuarios activos hoy</span>
        </div>
        <span className="text-sm font-medium">{health.activeUsersToday}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <span>Llamadas API hoy</span>
        </div>
        <span className="text-sm font-medium">{health.apiCallsToday}</span>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>Última sincronización</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {health.lastSyncTime
            ? format(new Date(health.lastSyncTime), "HH:mm", { locale: es })
            : 'N/A'}
        </span>
      </div>

      <div className="pt-2 border-t text-[10px] text-muted-foreground/60">
        Uptime: {health.uptime}
      </div>
    </div>
  )
})
