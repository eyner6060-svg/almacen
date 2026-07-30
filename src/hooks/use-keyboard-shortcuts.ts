'use client'

import { useEffect } from 'react'

export interface Shortcut {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  alt?: boolean
  handler: (e: KeyboardEvent) => void
  description: string
  enabled?: boolean
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        if (shortcut.enabled === false) continue
        const ctrlOrMeta = shortcut.ctrl || shortcut.meta
        const metaPressed = e.metaKey || e.ctrlKey
        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          (ctrlOrMeta ? metaPressed : !metaPressed) &&
          !!shortcut.shift === e.shiftKey &&
          !!shortcut.alt === e.altKey
        ) {
          e.preventDefault()
          shortcut.handler(e)
          return
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}

