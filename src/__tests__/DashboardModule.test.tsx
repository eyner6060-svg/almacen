import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardModule } from '@/components/dashboard/DashboardModule'

// Mock de stores
vi.mock('@/store', () => ({
  useAuthStore: Object.assign(
    (selector?: (state: any) => any) => (selector ?? ((s: any) => s))({
      user: { role: 'ADMINISTRADOR', isAuthenticated: true },
      isAuthenticated: true,
    }),
    { getState: vi.fn(), setState: vi.fn(), subscribe: vi.fn() }
  ),
  useConfigStore: (selector?: (state: any) => any) => (selector ?? ((s: any) => s))({
    config: {
      primaryColor: '#1e40af',
      secondaryColor: '#3b82f6',
      accentColor: '#f59e0b',
      institutionName: 'Test',
    }
  }),
  useModuleStore: (selector?: (state: any) => any) => (selector ?? ((s: any) => s))({ module: 'dashboard', setModule: vi.fn() }),
  useDashboardStore: Object.assign(
    (selector?: (state: any) => any) => (selector ?? ((s: any) => s))({
      layout: null,
      reorderWidgets: vi.fn(),
      toggleWidget: vi.fn(),
      isVisible: vi.fn(() => true),
      getWidgetSettings: vi.fn(() => ({})),
      widgets: ['kpi-total-items', 'kpi-low-stock'],
      setWidgets: vi.fn(),
      stats: null,
      setStats: vi.fn(),
      isLoading: false,
      error: null,
    }),
    { getState: vi.fn(), setState: vi.fn(), subscribe: vi.fn() }
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('DashboardModule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('muestra el titulo del panel', () => {
    render(<DashboardModule onNavigate={vi.fn()} />)
    expect(screen.getByText(/Dashboard|Panel|Control/i)).toBeDefined()
  })
})
