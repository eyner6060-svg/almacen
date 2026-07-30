'use client'

import { memo, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { apiFetch } from '@/lib/http'
import { Activity, User, Package, FileText } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ActivityEvent {
  id: number
  type: string
  action: string
  entityType: string
  entityId: number
  userId: number
  userName: string
  description: string
  createdAt: string
}

export const WidgetRecentActivity = memo(function WidgetRecentActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiFetch('/api/audit-logs?limit=10')
      .then(res => res.ok ? res.json() : { logs: [] })
      .then(data => setEvents(data.logs || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-sm">Actividad Reciente</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </CardContent>
      </Card>
    )
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'USER': return <User className="h-4 w-4" />
      case 'ITEM': return <Package className="h-4 w-4" />
      case 'ORDER': return <FileText className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Actividad Reciente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[280px]">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin actividad reciente</p>
          ) : (
            <div className="space-y-0">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 py-2 border-b last:border-0">
                  <div className="mt-0.5 text-muted-foreground">{getIcon(event.entityType)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{event.description || event.action}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{event.userName}</span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: es })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
})
