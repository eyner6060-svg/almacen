'use client'

import { Badge } from '@/components/ui/badge'
import { Clock, UserCheck, PackageCheck, CheckCircle, XCircle } from 'lucide-react'
import type { OrderStatus } from '@/types'

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ElementType; description: string }> = {
  PENDIENTE: {
    label: 'Pendiente',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-950/30 dark:text-yellow-400 dark:border-yellow-800',
    icon: Clock,
    description: 'Esperando autorización del Jefe de Oficina'
  },
  AUTORIZADO_JEFE: {
    label: 'Autorizado por Jefe',
    color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800',
    icon: UserCheck,
    description: 'Aprobado por Jefe, esperando preparación en almacén'
  },
  AUTORIZADO_ALMACENERO: {
    label: 'Listo para Entrega',
    color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800',
    icon: PackageCheck,
    description: 'Bienes preparados, listos para ser entregados'
  },
  COMPLETADO: {
    label: 'Entregado',
    color: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700',
    icon: CheckCircle,
    description: 'Bienes entregados al solicitante'
  },
  RECHAZADO: {
    label: 'Rechazado',
    color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    icon: XCircle,
    description: 'Pedido rechazado'
  },
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <Badge variant="outline" className={`gap-1.5 font-medium ${config.color}`}>
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{config.label}</span>
      <span className="sm:hidden">{config.label.split(' ')[0]}</span>
    </Badge>
  )
}

export { statusConfig }
