'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types'
import { useModuleStore } from './ui.store'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: true,
      isAuthenticated: false,
      setUser: (user) => set({
        user,
        isAuthenticated: !!user,
        isLoading: false
      }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => {
        set({ user: null, isAuthenticated: false, isLoading: false })
        useModuleStore.getState().setModule('dashboard')
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user ? { id: state.user.id, fullName: state.user.fullName, role: state.user.role, email: state.user.email } : null,
        isAuthenticated: state.isAuthenticated
      }),
      onRehydrateStorage: () => (state) => {
        state?.setLoading(false)
      }
    }
  )
)
