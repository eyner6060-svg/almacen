'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { OrderStatusBadge } from './order-status-badge'
import type { Order, OrderStatus } from '@/types'

interface OrderKanbanViewProps {
  orders: Order[]
  onViewOrder: (order: Order) => void
}

const COLUMN_CONFIG: Record<OrderStatus, { title: string; headerClass: string; borderClass: string }> = {
  PENDIENTE: { title: 'Pendiente', headerClass: 'bg-blue-100 text-blue-800', borderClass: 'border-blue-200' },
  AUTORIZADO_JEFE: { title: 'Autorizado por Jefe', headerClass: 'bg-amber-100 text-amber-800', borderClass: 'border-amber-200' },
  AUTORIZADO_ALMACENERO: { title: 'Listo para Entrega', headerClass: 'bg-amber-100 text-amber-800', borderClass: 'border-amber-200' },
  COMPLETADO: { title: 'Entregado', headerClass: 'bg-green-100 text-green-800', borderClass: 'border-green-200' },
  RECHAZADO: { title: 'Rechazado', headerClass: 'bg-red-100 text-red-800', borderClass: 'border-red-200' },
}

const COLUMNS = Object.entries(COLUMN_CONFIG) as [OrderStatus, typeof COLUMN_CONFIG[OrderStatus]][]

export function OrderKanbanView({ orders, onViewOrder }: OrderKanbanViewProps) {
  const grouped = useMemo(() => {
    const map: Record<OrderStatus, Order[]> = {
      PENDIENTE: [],
      AUTORIZADO_JEFE: [],
      AUTORIZADO_ALMACENERO: [],
      COMPLETADO: [],
      RECHAZADO: [],
    }
    orders.forEach((order) => {
      if (map[order.status]) {
        map[order.status].push(order)
      }
    })
    return map
  }, [orders])

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-4 min-w-max">
        {COLUMNS.map(([status, config]) => {
          const columnOrders = grouped[status]
          return (
            <div
              key={status}
              className={`w-72 flex-shrink-0 border rounded-lg ${config.borderClass}`}
            >
              <div className={`px-4 py-3 rounded-t-lg font-semibold flex items-center justify-between ${config.headerClass}`}>
                <span>{config.title}</span>
                <Badge variant="secondary">{columnOrders.length}</Badge>
              </div>
              <div className="p-2 space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto bg-white rounded-b-lg">
                {columnOrders.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Sin pedidos
                  </div>
                ) : (
                  columnOrders.map((order) => (
                    <Card
                      key={order.id}
                      className="cursor-pointer hover:shadow-md transition-shadow border"
                      onClick={() => onViewOrder(order)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-sm truncate">{order.orderNumber}</span>
                          <Badge variant="outline" className="shrink-0 text-xs">
                            {order.items.length} ítems
                          </Badge>
                        </div>
                        <div className="text-sm">
                          <p className="font-medium truncate">{order.requestedBy.fullName}</p>
                          <p className="text-xs text-muted-foreground truncate">{order.requestedBy.position}</p>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground shrink-0">
                            {format(new Date(order.createdAt), 'dd/MM/yyyy')}
                          </span>
                          <OrderStatusBadge status={order.status} />
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
