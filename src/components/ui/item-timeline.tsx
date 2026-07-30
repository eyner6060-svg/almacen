'use client'

import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import type { ReactNode } from 'react'

interface TimelineEvent {
  id: string | number
  date: string
  title: string
  description?: string
  icon?: ReactNode
  color?: string
}

interface ItemTimelineProps {
  events: TimelineEvent[]
  className?: string
}

export function ItemTimeline({ events, className }: ItemTimelineProps) {
  if (events.length === 0) return null
  return (
    <div className={cn("relative pl-8 space-y-0", className)}>
      {/* Línea vertical */}
      <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />
      {events.map((event) => (
        <div key={event.id} className="relative pb-6 last:pb-0">
          {/* Punto */}
          <div className={cn(
            "absolute -left-[19px] top-1 h-3 w-3 rounded-full border-2 border-background z-10",
            event.color || "bg-primary"
          )} />
          {/* Contenido */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {event.icon}
              <p className="text-sm font-medium">{event.title}</p>
            </div>
            {event.description && (
              <p className="text-xs text-muted-foreground">{event.description}</p>
            )}
            <p className="text-[10px] text-muted-foreground/60">
              {format(new Date(event.date), "d MMM yyyy HH:mm", { locale: es })}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}
