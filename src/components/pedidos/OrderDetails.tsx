'use client'

import { OrderStatusBadge, statusConfig } from './order-status-badge'
import type { Order } from '@/types'

interface OrderDetailsProps {
  order: Order
}

export function OrderDetails({ order }: OrderDetailsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Solicitante</p>
        <p className="font-medium">{order.requestedBy.fullName}</p>
        <p className="text-xs text-muted-foreground">{order.requestedBy.position}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Oficina</p>
        <p className="font-medium">{order.office.name}</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Fecha Solicitud</p>
        <p className="font-medium">
          {new Date(order.createdAt).toLocaleDateString('es-PE')}
        </p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Estado Actual</p>
        <OrderStatusBadge status={order.status} />
        <p className="text-xs text-muted-foreground mt-1">{statusConfig[order.status]?.description || ''}</p>
      </div>
    </div>
  )
}
