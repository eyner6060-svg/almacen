import { describe, it, expect, beforeEach } from 'vitest'
import {
  useSidebarStore,
  useModuleStore,
  useThemeStore,
  useSearchStore,
} from '@/store'

describe('useSidebarStore', () => {
  beforeEach(() => {
    useSidebarStore.setState({ isOpen: true })
  })

  it('inicializa con sidebar abierto', () => {
    expect(useSidebarStore.getState().isOpen).toBe(true)
  })

  it('toggle cambia el estado', () => {
    useSidebarStore.getState().toggle()
    expect(useSidebarStore.getState().isOpen).toBe(false)
    useSidebarStore.getState().toggle()
    expect(useSidebarStore.getState().isOpen).toBe(true)
  })

  it('setOpen establece valor específico', () => {
    useSidebarStore.getState().setOpen(false)
    expect(useSidebarStore.getState().isOpen).toBe(false)
    useSidebarStore.getState().setOpen(true)
    expect(useSidebarStore.getState().isOpen).toBe(true)
  })
})

describe('useModuleStore', () => {
  beforeEach(() => {
    useModuleStore.setState({ currentModule: 'dashboard' })
  })

  it('inicializa con módulo dashboard', () => {
    expect(useModuleStore.getState().currentModule).toBe('dashboard')
  })

  it('setModule cambia el módulo actual', () => {
    useModuleStore.getState().setModule('inventario')
    expect(useModuleStore.getState().currentModule).toBe('inventario')
    useModuleStore.getState().setModule('pedidos')
    expect(useModuleStore.getState().currentModule).toBe('pedidos')
  })
})

describe('useThemeStore', () => {
  beforeEach(() => {
    useThemeStore.setState({ isDarkMode: false })
  })

  it('inicializa con modo claro', () => {
    expect(useThemeStore.getState().isDarkMode).toBe(false)
  })

  it('toggleDarkMode cambia el modo', () => {
    useThemeStore.getState().toggleDarkMode()
    expect(useThemeStore.getState().isDarkMode).toBe(true)
    useThemeStore.getState().toggleDarkMode()
    expect(useThemeStore.getState().isDarkMode).toBe(false)
  })

  it('setDarkMode establece valor específico', () => {
    useThemeStore.getState().setDarkMode(true)
    expect(useThemeStore.getState().isDarkMode).toBe(true)
  })
})

describe('useSearchStore', () => {
  beforeEach(() => {
    useSearchStore.setState({ searchOpen: false })
  })

  it('inicializa con búsqueda cerrada', () => {
    expect(useSearchStore.getState().searchOpen).toBe(false)
  })

  it('setSearchOpen abre y cierra', () => {
    useSearchStore.getState().setSearchOpen(true)
    expect(useSearchStore.getState().searchOpen).toBe(true)
    useSearchStore.getState().setSearchOpen(false)
    expect(useSearchStore.getState().searchOpen).toBe(false)
  })
})
