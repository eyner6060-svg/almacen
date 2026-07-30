import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/store'

function createMockUser(overrides = {}) {
  return {
    id: 1,
    fullName: 'Admin Test',
    dni: '12345678',
    phone: '999888777',
    position: 'Administrador',
    email: 'admin@test.com',
    role: 'ADMINISTRADOR' as const,
    isActive: true,
    officeId: 1,
    office: null,
    isDriver: false,
    canAuthorizeOrders: true,
    canAuthorizeFuel: true,
    canAuthorizeAssignments: true,
    canAuthorizeLoans: true,
    vehicle: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isLoading: true,
      isAuthenticated: false,
    })
  })

  it('inicializa con valores por defecto', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(true)
  })

  it('setUser establece usuario y autenticación', () => {
    const user = createMockUser()
    useAuthStore.getState().setUser(user)
    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
  })

  it('setUser con null desautentica', () => {
    useAuthStore.getState().setUser(null)
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('setLoading cambia estado de carga', () => {
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
    useAuthStore.getState().setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)
  })

  it('logout limpia todo', () => {
    useAuthStore.getState().setUser(createMockUser())
    useAuthStore.getState().logout()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('persist parcializa correctamente', () => {
    const user = createMockUser({ pin: '1234', twoFactorEnabled: true })
    useAuthStore.getState().setUser(user)
    const persisted = useAuthStore.persist.getOptions()
    const partialize = persisted.partialize!
    const partial = partialize(useAuthStore.getState())
    expect(partial.isAuthenticated).toBe(true)
    expect(partial.user).toBeDefined()
    expect(partial.user!.id).toBe(1)
    expect(partial.user!.fullName).toBe('Admin Test')
    expect(partial.user!.role).toBe('ADMINISTRADOR')
    expect(partial.user!.email).toBe('admin@test.com')
    expect((partial.user! as any).pin).toBeUndefined()
    expect((partial.user! as any).twoFactorEnabled).toBeUndefined()
  })
})
