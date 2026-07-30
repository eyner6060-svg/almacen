'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Module = 'dashboard' | 'inventario' | 'catalogo' | 'pedidos' | 'usuarios' | 'oficinas' | 'almacenes' | 'configuracion' | 'perfil' | 'ingresos' | 'combustible' | 'firmas' | 'vehiculos' | 'reportes' | 'notificaciones' | 'workflows' | 'traceability' | 'garantias' | 'api-settings' | 'sincronizacion' | 'predicciones' | 'api-docs' | 'auditoria-forense' | 'firma-digital' | 'bienes-asignados' | 'autorizadores' | 'backups' | 'retorno' | 'prestamos' | 'tdr' | 'papelera'

interface SidebarState {
  isOpen: boolean
  toggle: () => void
  setOpen: (open: boolean) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
      setOpen: (isOpen) => set({ isOpen })
    }),
    {
      name: 'sidebar-storage',
      partialize: (state) => ({ isOpen: state.isOpen })
    }
  )
)

interface ModuleState {
  currentModule: Module
  setModule: (module: Module) => void
}

export const useModuleStore = create<ModuleState>((set) => ({
  currentModule: 'dashboard',
  setModule: (currentModule) => set({ currentModule })
}))

interface ThemeState {
  isDarkMode: boolean
  toggleDarkMode: () => void
  setDarkMode: (isDark: boolean) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      isDarkMode: false,
      toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
      setDarkMode: (isDarkMode) => set({ isDarkMode })
    }),
    {
      name: 'theme-storage'
    }
  )
)

interface SearchState {
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
}

export const useSearchStore = create<SearchState>((set) => ({
  searchOpen: false,
  setSearchOpen: (searchOpen) => set({ searchOpen })
}))
