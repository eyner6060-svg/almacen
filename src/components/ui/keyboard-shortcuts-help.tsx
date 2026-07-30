'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Command } from 'lucide-react'

interface ShortcutItem {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  label: string
  shortcuts: ShortcutItem[]
}

interface KeyboardShortcutsHelpProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const groups: ShortcutGroup[] = [
  {
    label: 'Navegación',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Búsqueda global de módulos' },
      { keys: ['Ctrl', 'N'], description: 'Nuevo elemento' },
    ],
  },
  {
    label: 'Ayuda',
    shortcuts: [
      { keys: ['?'], description: 'Mostrar atajos de teclado' },
      { keys: ['Shift', '/'], description: 'Mostrar atajos de teclado' },
    ],
  },
]

function formatKeys(keys: string[]) {
  return keys.map((key) => {
    if (key === 'Ctrl') return <span key={key} className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono">Ctrl</span>
    if (key === 'Shift') return <span key={key} className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono">Shift</span>
    if (key === 'Alt') return <span key={key} className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono">Alt</span>
    if (key === 'Cmd') return (
      <span key={key} className="px-1.5 py-0.5 text-xs bg-muted rounded flex items-center gap-0.5">
        <Command className="h-3 w-3" />
      </span>
    )
    return <span key={key} className="px-1.5 py-0.5 text-xs bg-muted rounded font-mono">{key}</span>
  })
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle>Atajos de Teclado</DialogTitle>
          <DialogDescription>
            Atajos disponibles en toda la aplicación
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-80">
          <div className="space-y-4 pr-2">
            {groups.map((group) => (
              <div key={group.label}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">
                  {group.label}
                </h4>
                <div className="space-y-1.5">
                  {group.shortcuts.map((shortcut, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-1.5"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1 ml-4">
                        {formatKeys(shortcut.keys)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
