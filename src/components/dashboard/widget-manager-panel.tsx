'use client'

import { useMemo } from 'react'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/store'
import { useDashboardStore, WIDGET_REGISTRY } from '@/store/stores/dashboard.store'
import { Settings2, RotateCcw, Package, BarChart3, Table2, Computer } from 'lucide-react'
import type { Role } from '@/types'

interface WidgetManagerPanelProps {
  children?: React.ReactNode
}

const TYPE_ICONS = {
  kpi: Package,
  chart: BarChart3,
  table: Table2,
  badges: Computer,
} as const

const TYPE_LABELS = {
  kpi: 'Indicadores',
  chart: 'Gráficos',
  table: 'Tablas',
  badges: 'Información',
} as const

const WIDGET_ROLES: Record<string, Role[]> = {
  'kpi-total-items': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
  'kpi-pending-orders': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
  'kpi-monthly-orders': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
  'kpi-low-stock': ['ADMINISTRADOR', 'ALMACENERO'],
  'kpi-items-on-loan': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'],
  'kpi-fuel-gasoline': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'],
  'kpi-fuel-petroleum': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'],
  'chart-inventory-trends': ['ADMINISTRADOR', 'ALMACENERO'],
  'chart-orders-by-user': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
  'chart-items-by-category': ['ADMINISTRADOR', 'ALMACENERO'],
  'chart-consumption-by-office': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
  'chart-stock-levels': ['ADMINISTRADOR', 'ALMACENERO'],
  'chart-fuel-users': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'],
  'chart-fuel-monthly': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'],
  'chart-orders-by-status': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
  'chart-monthly-comparison': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
  'table-low-stock': ['ADMINISTRADOR', 'ALMACENERO'],
  'table-warranty-alerts': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
  'table-items-on-loan': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'],
  'badges-categories': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
  'workflow-stats': ['ADMINISTRADOR'],
  'system-health': ['ADMINISTRADOR'],
  'activity-recent': ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
}

export function WidgetManagerPanel({ children }: WidgetManagerPanelProps) {
  const user = useAuthStore(s => s.user)
  const toggleWidget = useDashboardStore(s => s.toggleWidget)
  const resetLayout = useDashboardStore(s => s.resetLayout)
  const isVisible = useDashboardStore(s => s.isVisible)

  const groupedWidgets = useMemo(() => {
    const userRole = user?.role
    const groups: Record<string, typeof WIDGET_REGISTRY> = {}
    for (const type of ['kpi', 'chart', 'table', 'badges'] as const) {
      groups[type as string] = WIDGET_REGISTRY.filter(w =>
        w.type === type && (!userRole || WIDGET_ROLES[w.id]?.includes(userRole))
      )
    }
    return groups
  }, [user])

  return (
    <Sheet>
      <SheetTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Settings2 className="h-4 w-4 mr-2" />
            Widgets
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Administrar Widgets</SheetTitle>
          <SheetDescription>
            Activa o desactiva los widgets del dashboard
          </SheetDescription>
        </SheetHeader>

        <div className="flex justify-end mt-4">
          <Button variant="ghost" size="sm" onClick={resetLayout}>
            <RotateCcw className="h-3.5 w-3.5 mr-2" />
            Restaurar por defecto
          </Button>
        </div>

        <ScrollArea className="h-[calc(100vh-12rem)] pr-4 mt-2">
          <div className="space-y-6">
            {(Object.entries(groupedWidgets) as [string, (typeof WIDGET_REGISTRY)][]).map(([type, widgets]) => {
              if (widgets.length === 0) return null
              const Icon = TYPE_ICONS[type as keyof typeof TYPE_ICONS] || Package
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      {TYPE_LABELS[type as keyof typeof TYPE_LABELS] || type}
                    </h4>
                  </div>
                  <div className="space-y-1">
                    {widgets.map(widget => {
                      const visible = isVisible(widget.id)
                      return (
                        <div
                          key={widget.id}
                          className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${visible ? '' : 'text-muted-foreground/60'}`}>
                              {widget.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {widget.defaultWidth === 'full' ? 'Ancho completo' : widget.defaultWidth === 'half' ? 'Medio ancho' : 'Un tercio'}
                            </p>
                          </div>
                          <Switch
                            checked={visible}
                            onCheckedChange={() => toggleWidget(widget.id)}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <Separator className="mt-4" />
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
