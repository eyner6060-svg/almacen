'use client'

import { useState, useEffect, useCallback, useRef, useMemo, startTransition } from 'react'
import { useModuleStore, type Module } from '@/store'
import { normalizeText } from '@/lib/utils'
import { Search, Command, Package, Users, Building2, ClipboardList, FileText, Settings, Zap, Fuel, Truck, Shield, TrendingUp, BookOpen, Box, Menu, UserCheck, Activity, GitBranch, RefreshCw, BarChart3, Globe, Bell, Database } from 'lucide-react'

interface SearchResult {
  id: string
  label: string
  description?: string
  icon: React.ElementType
  type: 'module' | 'item' | 'user' | 'order'
  action: () => void
}

const moduleMap: Record<string, { label: string; icon: React.ElementType }> = {
  dashboard: { label: 'Dashboard', icon: Box },
  inventario: { label: 'Inventario', icon: Package },
  catalogo: { label: 'Catálogo', icon: BookOpen },
  pedidos: { label: 'Pedidos', icon: ClipboardList },
  ingresos: { label: 'Ingresos', icon: TrendingUp },
  usuarios: { label: 'Usuarios', icon: Users },
  oficinas: { label: 'Oficinas', icon: Building2 },
  almacenes: { label: 'Almacenes', icon: Box },
  configuracion: { label: 'Configuración', icon: Settings },
  perfil: { label: 'Mi Perfil', icon: Users },
  combustible: { label: 'Combustible', icon: Fuel },
  vehiculos: { label: 'Vehículos', icon: Truck },
  reportes: { label: 'Reportes', icon: FileText },
  garantias: { label: 'Garantías', icon: Shield },
  workflows: { label: 'Flujos de Trabajo', icon: Zap },
  traceability: { label: 'Trazabilidad', icon: Menu },
  'firma-digital': { label: 'Firma Digital', icon: Shield },
  'bienes-asignados': { label: 'Bienes Asignados', icon: UserCheck },
  firmas: { label: 'Firmas', icon: Activity },
  notificaciones: { label: 'Notificaciones', icon: Bell },
  'auditoria-forense': { label: 'Auditoría Forense', icon: GitBranch },
  apiSettings: { label: 'API Settings', icon: Globe },
  sincronizacion: { label: 'Sincronización', icon: RefreshCw },
  predicciones: { label: 'Predicciones', icon: BarChart3 },
  'api-docs': { label: 'API Docs', icon: BookOpen },
  'api-settings': { label: 'API Settings', icon: Database },
}

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const { setModule } = useModuleStore()

  useEffect(() => {
    if (open) {
      startTransition(() => {
        setQuery('')
        setSelectedIndex(0)
      })
      const timer = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(timer)
    }
  }, [open])

  const navigateTo = useCallback((moduleId: string) => {
    setModule(moduleId as Module)
    onOpenChange(false)
  }, [setModule, onOpenChange])

  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) {
      const moduleResults: SearchResult[] = Object.entries(moduleMap).map(([id, info]) => ({
        id: `module-${id}`,
        label: info.label,
        type: 'module',
        icon: info.icon,
        action: () => navigateTo(id),
      }))
      return moduleResults.slice(0, 8)
    }

    const q = normalizeText(query)
    const filtered: SearchResult[] = Object.entries(moduleMap)
      .filter(([id, info]) =>
        normalizeText(id).includes(q) || normalizeText(info.label).includes(q)
      )
      .map(([id, info]) => ({
        id: `module-${id}`,
        label: info.label,
        type: 'module' as const,
        icon: info.icon,
        action: () => navigateTo(id),
      }))

    return filtered.slice(0, 8)
  }, [query, navigateTo])

  const displayIndex = Math.min(selectedIndex, Math.max(0, results.length - 1))

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, results.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (results[displayIndex]) {
          results[displayIndex].action()
        }
        break
      case 'Escape':
        onOpenChange(false)
        break
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border dark:border-zinc-800 overflow-hidden">
        <div className="flex items-center px-4 border-b dark:border-zinc-800">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar módulos, items, usuarios..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 h-14 px-3 bg-transparent outline-none text-base placeholder:text-muted-foreground/60"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground bg-muted rounded">
            <Command className="h-3 w-3" />K
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sin resultados para &quot;{query}&quot;
            </div>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  onClick={item.action}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    i === displayIndex
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <span className="text-xs text-muted-foreground capitalize">{item.type}</span>
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t dark:border-zinc-800 text-xs text-muted-foreground">
          <span><kbd className="px-1 py-0.5 bg-muted rounded">↑↓</kbd> Navegar</span>
          <span><kbd className="px-1 py-0.5 bg-muted rounded">↵</kbd> Abrir</span>
          <span><kbd className="px-1 py-0.5 bg-muted rounded">Esc</kbd> Cerrar</span>
        </div>
      </div>
    </div>
  )
}
