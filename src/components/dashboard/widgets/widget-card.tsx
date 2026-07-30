'use client'

import type { ReactNode } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, EyeOff, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { useDashboardStore } from '@/store/stores/dashboard.store'

interface WidgetCardProps {
  id: string
  title: string
  children: ReactNode
  onToggleVisibility?: () => void
}

export function WidgetCard({ id, title, children, onToggleVisibility }: WidgetCardProps) {
  const updateWidgetSettings = useDashboardStore(s => s.updateWidgetSettings)
  const getWidgetSettings = useDashboardStore(s => s.getWidgetSettings)
  const getConfig = useDashboardStore(s => s.getConfig)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto' as const,
  }

  const settings = getWidgetSettings(id)
  const config = getConfig(id)
  const displayTitle = settings?.customTitle || title

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border bg-card shadow-sm ${isDragging ? 'shadow-lg ring-2 ring-primary/20' : ''}`}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30 rounded-t-xl">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Arrastrar para reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <h3 className="text-sm font-semibold text-foreground">{displayTitle}</h3>
        </div>
        <div className="flex items-center gap-1">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                title="Configuración del widget"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56">
              <div className="space-y-3">
                <h4 className="text-sm font-medium">Configuración</h4>
                <div className="space-y-2">
                  <Label className="text-xs">Título personalizado</Label>
                  <Input
                    size={1}
                    className="h-8 text-sm"
                    placeholder={title}
                    value={settings?.customTitle || ''}
                    onChange={(e) => updateWidgetSettings(id, { customTitle: e.target.value || undefined })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Ancho</Label>
                  <Select
                    value={settings?.width || config?.defaultWidth || 'half'}
                    onValueChange={(v) => updateWidgetSettings(id, { width: v as 'full' | 'half' | 'third' })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Completo</SelectItem>
                      <SelectItem value="half">Mitad</SelectItem>
                      <SelectItem value="third">Tercio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          {onToggleVisibility && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onToggleVisibility}
              title="Ocultar widget"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
