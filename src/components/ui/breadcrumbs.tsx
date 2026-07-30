'use client'

import { useModuleStore } from '@/store'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const moduleLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  inventario: 'Inventario',
  catalogo: 'Catálogo',
  pedidos: 'Pedidos',
  ingresos: 'Ingresos',
  usuarios: 'Usuarios',
  vehiculos: 'Vehículos',
  oficinas: 'Oficinas',
  almacenes: 'Almacenes',
  configuracion: 'Configuración',
  perfil: 'Mi Perfil',
  combustible: 'Combustible',
  firmas: 'Config. Firmas',
  reportes: 'Reportes',
  notificaciones: 'Notificaciones',
  workflows: 'Flujos de Trabajo',
  traceability: 'Trazabilidad',
  garantias: 'Garantías',
  'api-docs': 'API Docs',
  predicciones: 'Predicciones',
  sincronizacion: 'Sync SIGA',
  'auditoria-forense': 'Auditoría Forense',
  'firma-digital': 'Firma Digital',
  'backups': 'Copias de Seguridad',
}

interface BreadcrumbsProps {
  items?: { label: string; onClick?: () => void }[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const { currentModule } = useModuleStore()
  const moduleLabel = moduleLabels[currentModule] || currentModule

  const crumbs = items || [
    { label: 'Inicio' },
    { label: moduleLabel },
  ]

  return (
    <nav className={cn('flex items-center gap-1 text-sm text-muted-foreground mb-4', className)}>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5" />}
          {crumb.onClick ? (
            <button
              onClick={crumb.onClick}
              className="hover:text-foreground transition-colors"
            >
              {crumb.label}
            </button>
          ) : (
            <span className={i === crumbs.length - 1 ? 'text-foreground font-medium' : ''}>
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  )
}
