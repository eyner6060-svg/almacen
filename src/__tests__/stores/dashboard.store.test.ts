import { describe, it, expect, beforeEach } from 'vitest'
import { useDashboardStore } from '@/store/stores/dashboard.store'

describe('useDashboardStore', () => {
  beforeEach(() => {
    useDashboardStore.getState().resetLayout()
  })

  it('inicializa con layout por defecto', () => {
    const state = useDashboardStore.getState()
    expect(state.layout.widgets.length).toBeGreaterThan(0)
    expect(state.layout.hiddenWidgets).toHaveLength(0)
  })

  it('toggleWidget oculta y muestra widgets', () => {
    const firstWidget = useDashboardStore.getState().layout.widgets[0]!
    useDashboardStore.getState().toggleWidget(firstWidget)
    expect(useDashboardStore.getState().layout.hiddenWidgets).toContain(firstWidget)

    useDashboardStore.getState().toggleWidget(firstWidget)
    expect(useDashboardStore.getState().layout.hiddenWidgets).not.toContain(firstWidget)
  })

  it('reorderWidgets cambia orden', () => {
    const original = [...useDashboardStore.getState().layout.widgets]
    const reversed = [...original].reverse()
    useDashboardStore.getState().reorderWidgets(reversed)
    expect(useDashboardStore.getState().layout.widgets).toEqual(reversed)
  })

  it('resetLayout restaura valores iniciales', () => {
    useDashboardStore.getState().reorderWidgets([])
    useDashboardStore.getState().resetLayout()
    expect(useDashboardStore.getState().layout.widgets.length).toBeGreaterThan(0)
  })

  it('isVisible verifica visibilidad', () => {
    const firstWidget = useDashboardStore.getState().layout.widgets[0]!
    expect(useDashboardStore.getState().isVisible(firstWidget)).toBe(true)
    useDashboardStore.getState().toggleWidget(firstWidget)
    expect(useDashboardStore.getState().isVisible(firstWidget)).toBe(false)
  })

  it('getConfig retorna configuración del widget', () => {
    const config = useDashboardStore.getState().getConfig('kpi-total-items')
    expect(config).toBeDefined()
    expect(config!.title).toBe('Total Bienes')
    expect(config!.type).toBe('kpi')
  })

  it('getConfig retorna undefined para widget inexistente', () => {
    const config = useDashboardStore.getState().getConfig('non-existent')
    expect(config).toBeUndefined()
  })

  it('updateWidgetSettings y getWidgetSettings', () => {
    const widgetId = 'kpi-total-items'
    useDashboardStore.getState().updateWidgetSettings(widgetId, { customTitle: 'My Widget' })
    const settings = useDashboardStore.getState().getWidgetSettings(widgetId)
    expect(settings).toEqual({ customTitle: 'My Widget' })

    useDashboardStore.getState().updateWidgetSettings(widgetId, { width: 'full' })
    const updated = useDashboardStore.getState().getWidgetSettings(widgetId)
    expect(updated).toEqual({ customTitle: 'My Widget', width: 'full' })
  })

  it('getAvailableWidgets retorna todos los widgets', () => {
    const available = useDashboardStore.getState().getAvailableWidgets()
    expect(available.length).toBeGreaterThan(20)
    expect(available.some(w => w.id === 'kpi-total-items')).toBe(true)
    expect(available.some(w => w.id === 'activity-recent')).toBe(true)
  })
})
