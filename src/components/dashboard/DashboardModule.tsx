'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore, useConfigStore } from '@/store'
import { useDashboardStore, WIDGET_REGISTRY } from '@/store/stores/dashboard.store'
import { apiFetch } from '@/lib/http'
import { toast } from 'sonner'
import {
  Package, Plus, FileText, TrendingUp, RefreshCw,
} from 'lucide-react'
import { DndContext, DragOverlay, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { DashboardStats, Role } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  WidgetCard,
  KpiTotalItems, KpiPendingOrders, KpiMonthlyOrders, KpiLowStock, KpiItemsOnLoan,
  KpiFuelGasoline, KpiFuelPetroleum,
  KpiTotalPatrimonialUnits, KpiPatrimonialUnitsOut, KpiOverdueReturns,
  ChartInventoryTrends, ChartOrdersByUser, ChartItemsByCategory,
  ChartConsumptionByOffice, ChartStockLevels, ChartFuelUsers, ChartFuelMonthly,
  ChartOrdersByStatus, ChartMonthlyComparison,
  TableLowStock, TableWarrantyAlerts, TableItemsOnLoan,
  BadgesCategories, WidgetWorkflowStats,
  WidgetSystemHealth,
  WidgetRecentActivity,
} from './widgets'
import { WidgetManagerPanel } from './widget-manager-panel'

interface DashboardModuleProps {
  onNavigate: (module: string) => void
}

const QUICK_ACTION_ROLES: Record<string, Role[]> = {
  pedidos: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA', 'TRABAJADOR'],
  inventario: ['ADMINISTRADOR', 'ALMACENERO'],
  ingresos: ['ADMINISTRADOR', 'ALMACENERO'],
  reportes: ['ADMINISTRADOR', 'ALMACENERO', 'JEFE_OFICINA'],
}

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

export const DashboardModule = React.memo(function DashboardModule({ onNavigate }: DashboardModuleProps) {
  const config = useConfigStore(s => s.config)
  const user = useAuthStore(s => s.user)
  const layout = useDashboardStore(s => s.layout)
  const reorderWidgets = useDashboardStore(s => s.reorderWidgets)
  const toggleWidget = useDashboardStore(s => s.toggleWidget)
  const isVisible = useDashboardStore(s => s.isVisible)
  const getWidgetSettings = useDashboardStore(s => s.getWidgetSettings)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [activeId, setActiveId] = useState<string | null>(null)

  const primaryColor = config?.primaryColor || '#1e40af'
  const secondaryColor = config?.secondaryColor || '#3b82f6'
  const accentColor = config?.accentColor || '#f59e0b'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const fetchStats = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await apiFetch('/api/dashboard')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
        setLastUpdate(new Date())
      } else {
        toast.error('Error al actualizar dashboard')
      }
    } catch {
      toast.error('Error de conexión al actualizar dashboard')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  const userRole = user?.role

  const quickActions = useMemo(() => {
    const actions = [
      { id: 'pedidos', label: 'Nuevo Pedido', icon: Plus, color: primaryColor },
      { id: 'inventario', label: 'Ver Inventario', icon: Package, color: secondaryColor },
      { id: 'ingresos', label: 'Registrar Ingreso', icon: TrendingUp, color: '#10b981' },
      { id: 'reportes', label: 'Generar Reporte', icon: FileText, color: accentColor },
    ]
    return userRole ? actions.filter(a => QUICK_ACTION_ROLES[a.id]?.includes(userRole)) : []
  }, [userRole, primaryColor, secondaryColor, accentColor])

  const visibleWidgets = useMemo(
    () => layout.widgets.filter(id => isVisible(id) && (!userRole || WIDGET_ROLES[id]?.includes(userRole))),
    [layout, isVisible, userRole]
  )
  const visibleWidgetsRef = useRef(visibleWidgets)
  visibleWidgetsRef.current = visibleWidgets

  const getConfig = useCallback((id: string) => WIDGET_REGISTRY.find(w => w.id === id), [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    const currentWidgets = visibleWidgetsRef.current
    if (over && active.id !== over.id) {
      const oldIndex = currentWidgets.indexOf(active.id as string)
      const newIndex = currentWidgets.indexOf(over.id as string)
      if (oldIndex !== -1 && newIndex !== -1) {
        const result = Array.from(currentWidgets)
        const [removed] = result.splice(oldIndex, 1)
        if (removed) {
          result.splice(newIndex, 0, removed)
          reorderWidgets(result)
        }
      }
    }
  }, [reorderWidgets])

  const renderWidget = useCallback((widgetId: string) => {
    if (!stats) return null
    const cfg = getConfig(widgetId)
    if (!cfg) return null
    const settings = getWidgetSettings(widgetId)
    const width = settings?.width || cfg.defaultWidth
    const content = (() => {
      switch (widgetId) {
        case 'kpi-total-items': return <KpiTotalItems stats={stats} primaryColor={primaryColor} />
        case 'kpi-pending-orders': return <KpiPendingOrders stats={stats} secondaryColor={secondaryColor} />
        case 'kpi-monthly-orders': return <KpiMonthlyOrders stats={stats} secondaryColor={secondaryColor} />
        case 'kpi-low-stock': return <KpiLowStock stats={stats} />
        case 'kpi-items-on-loan': return <KpiItemsOnLoan stats={stats} accentColor={accentColor} />
        case 'kpi-total-patrimonial-units': return <KpiTotalPatrimonialUnits stats={stats} />
        case 'kpi-patrimonial-units-out': return <KpiPatrimonialUnitsOut stats={stats} accentColor={accentColor} />
        case 'kpi-overdue-returns': return <KpiOverdueReturns stats={stats} />
        case 'kpi-fuel-gasoline': return <KpiFuelGasoline stats={stats} />
        case 'kpi-fuel-petroleum': return <KpiFuelPetroleum stats={stats} />
        case 'chart-inventory-trends': return <ChartInventoryTrends stats={stats} />
        case 'chart-orders-by-user': return <ChartOrdersByUser stats={stats} primaryColor={primaryColor} />
        case 'chart-items-by-category': return <ChartItemsByCategory stats={stats} />
        case 'chart-consumption-by-office': return <ChartConsumptionByOffice stats={stats} secondaryColor={secondaryColor} />
        case 'chart-stock-levels': return <ChartStockLevels stats={stats} primaryColor={primaryColor} />
        case 'chart-fuel-users': return <ChartFuelUsers stats={stats} accentColor={accentColor} />
        case 'chart-fuel-monthly': return <ChartFuelMonthly stats={stats} />
        case 'chart-orders-by-status': return <ChartOrdersByStatus stats={stats} />
        case 'chart-monthly-comparison': return <ChartMonthlyComparison stats={stats} />
        case 'table-low-stock': return <TableLowStock stats={stats} onNavigate={onNavigate} />
        case 'table-warranty-alerts': return <TableWarrantyAlerts stats={stats} />
        case 'table-items-on-loan': return <TableItemsOnLoan stats={stats} accentColor={accentColor} />
        case 'badges-categories': return <BadgesCategories stats={stats} />
        case 'workflow-stats': return <WidgetWorkflowStats stats={stats} primaryColor={primaryColor} accentColor={accentColor} onNavigate={onNavigate} />
        case 'system-health': return <WidgetSystemHealth />
        case 'activity-recent': return <WidgetRecentActivity />
        default: return null
      }
    })()
    if (!content) return null
    return (
      <div key={widgetId} className={width === 'full' ? 'md:col-span-2' : 'md:col-span-1'}>
        <WidgetCard id={widgetId} title={cfg.title} onToggleVisibility={() => {
          toggleWidget(widgetId)
          toast.success(`Widget "${cfg.title}" ocultado`)
        }}>
          {content}
        </WidgetCard>
      </div>
    )
  }, [stats, primaryColor, secondaryColor, accentColor, onNavigate, getConfig, getWidgetSettings, toggleWidget])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Panel de Control</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="rounded-2xl border bg-card p-6 animate-pulse">
              <div className="flex items-start justify-between mb-4">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-8 w-16 bg-muted rounded" />
                </div>
                <div className="h-12 w-12 bg-muted rounded-xl" />
              </div>
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Ejecutivo</h1>
          <p className="text-sm text-muted-foreground">Bienvenido al Sistema de Gestión de Almacén</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Actualizado: {formatDistanceToNow(lastUpdate, { addSuffix: true, locale: es })}
          </span>
          <WidgetManagerPanel />
          <Button variant="outline" size="sm" onClick={fetchStats} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickActions.map(action => {
          const Icon = action.icon
          return (
            <Button key={action.id} variant="outline" size="sm" onClick={() => onNavigate(action.id)} className="gap-2">
              <Icon className="h-4 w-4" style={{ color: action.color }} />
              {action.label}
            </Button>
          )
        })}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={(e) => setActiveId(e.active.id as string)} onDragEnd={handleDragEnd}>
        <SortableContext items={visibleWidgets} strategy={verticalListSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleWidgets.map(renderWidget)}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className="rounded-xl border bg-card shadow-xl p-4 opacity-80">
              <p className="text-sm font-medium">{getConfig(activeId)?.title || ''}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
})
