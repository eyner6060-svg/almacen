'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WidgetId, DashboardLayout, WidgetConfig, WidgetSettings } from '@/types'

export const WIDGET_REGISTRY: WidgetConfig[] = [
  { id: 'kpi-total-items', title: 'Total Bienes', type: 'kpi', component: 'KpiTotalItems', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'kpi-pending-orders', title: 'Pedidos Pendientes', type: 'kpi', component: 'KpiPendingOrders', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'kpi-monthly-orders', title: 'Pedidos del Mes', type: 'kpi', component: 'KpiMonthlyOrders', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'kpi-low-stock', title: 'Alertas de Stock', type: 'kpi', component: 'KpiLowStock', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'kpi-items-on-loan', title: 'Patrimoniales Fuera', type: 'kpi', component: 'KpiItemsOnLoan', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'kpi-total-patrimonial-units', title: 'Unidades Patrimoniales', type: 'kpi', component: 'KpiTotalPatrimonialUnits', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'kpi-patrimonial-units-out', title: 'Unidades Fuera', type: 'kpi', component: 'KpiPatrimonialUnitsOut', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'kpi-overdue-returns', title: 'Retornos Vencidos', type: 'kpi', component: 'KpiOverdueReturns', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'kpi-fuel-gasoline', title: 'Gasolina', type: 'kpi', component: 'KpiFuelGasoline', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'kpi-fuel-petroleum', title: 'Petróleo', type: 'kpi', component: 'KpiFuelPetroleum', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'chart-inventory-trends', title: 'Tendencia de Inventario', type: 'chart', component: 'ChartInventoryTrends', defaultVisible: true, defaultRow: 1, defaultWidth: 'full', minHeight: 300 },
  { id: 'chart-orders-by-user', title: 'Usuarios con más Pedidos', type: 'chart', component: 'ChartOrdersByUser', defaultVisible: true, defaultRow: 2, defaultWidth: 'half', minHeight: 250 },
  { id: 'chart-items-by-category', title: 'Bienes por Categoría', type: 'chart', component: 'ChartItemsByCategory', defaultVisible: true, defaultRow: 2, defaultWidth: 'half', minHeight: 250 },
  { id: 'chart-consumption-by-office', title: 'Consumo por Oficina', type: 'chart', component: 'ChartConsumptionByOffice', defaultVisible: true, defaultRow: 3, defaultWidth: 'half', minHeight: 250 },
  { id: 'chart-stock-levels', title: 'Niveles de Stock', type: 'chart', component: 'ChartStockLevels', defaultVisible: true, defaultRow: 3, defaultWidth: 'half', minHeight: 250 },
  { id: 'chart-fuel-users', title: 'Top Consumidores de Combustible', type: 'chart', component: 'ChartFuelUsers', defaultVisible: true, defaultRow: 3, defaultWidth: 'half', minHeight: 250 },
  { id: 'chart-fuel-monthly', title: 'Consumo Mensual de Combustible', type: 'chart', component: 'ChartFuelMonthly', defaultVisible: true, defaultRow: 3, defaultWidth: 'half', minHeight: 250 },
  { id: 'chart-orders-by-status', title: 'Pedidos por Estado', type: 'chart', component: 'ChartOrdersByStatus', defaultVisible: false, defaultRow: 4, defaultWidth: 'half', minHeight: 250 },
  { id: 'chart-monthly-comparison', title: 'Comparativa Mensual', type: 'chart', component: 'ChartMonthlyComparison', defaultVisible: false, defaultRow: 4, defaultWidth: 'half', minHeight: 250 },
  { id: 'table-low-stock', title: 'Bienes con Stock Bajo', type: 'table', component: 'TableLowStock', defaultVisible: true, defaultRow: 5, defaultWidth: 'full' },
  { id: 'table-warranty-alerts', title: 'Alertas de Garantía', type: 'table', component: 'TableWarrantyAlerts', defaultVisible: true, defaultRow: 6, defaultWidth: 'half' },
  { id: 'table-items-on-loan', title: 'Bienes Patrimoniales en Préstamo', type: 'table', component: 'TableItemsOnLoan', defaultVisible: true, defaultRow: 6, defaultWidth: 'half' },
  { id: 'badges-categories', title: 'Distribución por Categoría', type: 'badges', component: 'BadgesCategories', defaultVisible: true, defaultRow: 7, defaultWidth: 'full' },
  { id: 'workflow-stats', title: 'Estado de Flujos de Trabajo', type: 'badges', component: 'WidgetWorkflowStats', defaultVisible: false, defaultRow: 7, defaultWidth: 'half' },
  { id: 'system-health', title: 'Salud del Sistema', type: 'kpi', component: 'WidgetSystemHealth', defaultVisible: true, defaultRow: 0, defaultWidth: 'third' },
  { id: 'activity-recent', title: 'Actividad Reciente', type: 'badges', component: 'WidgetRecentActivity', defaultVisible: false, defaultRow: 8, defaultWidth: 'full' },
]

const DEFAULT_LAYOUT: DashboardLayout = {
  widgets: WIDGET_REGISTRY.filter(w => w.defaultVisible).map(w => w.id),
  hiddenWidgets: [],
  widgetSettings: {},
}

interface DashboardStore {
  layout: DashboardLayout
  setLayout: (layout: DashboardLayout) => void
  toggleWidget: (widgetId: WidgetId) => void
  reorderWidgets: (widgets: WidgetId[]) => void
  resetLayout: () => void
  isVisible: (widgetId: WidgetId) => boolean
  getConfig: (widgetId: WidgetId) => WidgetConfig | undefined
  updateWidgetSettings: (widgetId: WidgetId, settings: Partial<WidgetSettings>) => void
  getWidgetSettings: (widgetId: WidgetId) => Partial<WidgetSettings> | undefined
  getAvailableWidgets: () => WidgetConfig[]
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      layout: DEFAULT_LAYOUT,
      setLayout: (layout) => set({ layout }),
      toggleWidget: (widgetId) => set((state) => {
        const hidden = state.layout.hiddenWidgets
        const isHidden = hidden.includes(widgetId)
        return {
          layout: {
            ...state.layout,
            hiddenWidgets: isHidden
              ? hidden.filter(id => id !== widgetId)
              : [...hidden, widgetId],
          }
        }
      }),
      reorderWidgets: (widgets) => set((state) => ({
        layout: { ...state.layout, widgets }
      })),
      resetLayout: () => set({ layout: DEFAULT_LAYOUT }),
      isVisible: (widgetId) => !get().layout.hiddenWidgets.includes(widgetId),
      getConfig: (widgetId) => WIDGET_REGISTRY.find(w => w.id === widgetId),
      updateWidgetSettings: (widgetId, settings) => set((state) => ({
        layout: {
          ...state.layout,
          widgetSettings: {
            ...state.layout.widgetSettings,
            [widgetId]: { ...state.layout.widgetSettings?.[widgetId], ...settings },
          },
        },
      })),
      getWidgetSettings: (widgetId) => get().layout.widgetSettings?.[widgetId],
      getAvailableWidgets: () => WIDGET_REGISTRY,
    }),
    { name: 'dashboard-layout' }
  )
)
