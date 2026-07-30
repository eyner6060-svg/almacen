'use client'

import { create } from 'zustand'
import type { SystemConfig } from '@/types'

interface ConfigState {
  config: SystemConfig | null
  setConfig: (config: SystemConfig) => void
}

export const useConfigStore = create<ConfigState>()((set) => ({
  config: null,
  setConfig: (config: ConfigState['config']) => set({ config })
}))
