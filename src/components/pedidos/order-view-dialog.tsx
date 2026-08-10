'use client'

import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  CheckCircle
} from 'lucide-react'
import type { Order, User } from '@/types'
import { useConfigStore } from '@/store'
import { OrderTimeline } from './OrderTimeline'
import { OrderDetails } from './OrderDetails'
import { OrderItemsTable } from './OrderItemsTable'
import { OrderAuthorizationPanel } from './OrderAuthorizationPanel'

interface OrderViewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: Order | null
  user: User | null
  onActionComplete: () => void
  onOrderUpdated?: (order: Order) => void
}

export function OrderViewDialog({ open, onOpenChange, order, user, onActionComplete, onOrderUpdated }: OrderViewDialogProps) {
  const { config } = useConfigStore()

  if (!order) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] md:max-w-7xl max-h-[90vh] sm:max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Pedido {order.orderNumber}
            </DialogTitle>
            <DialogDescription>
              Detalles del pedido y flujo de autorización
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <OrderTimeline order={order} />

            <OrderDetails order={order} />

            <Separator />

            <OrderItemsTable order={order} />

            {order.notes && (
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm font-medium text-yellow-800">Observaciones:</p>
                <p className="text-sm text-yellow-700">{order.notes}</p>
              </div>
            )}

            {order.authorizations.length > 0 && (
              <div>
                <h4 className="font-semibold mb-3">Autorizaciones Registradas</h4>
                <div className="space-y-2">
                  {order.authorizations.map((auth, _idx) => {
                    const displayRole = auth.role === 'JEFE_OFICINA' ? 'Jefe de Oficina' :
                      auth.role === 'ADMINISTRADOR' ? 'Administrador' : 'Almacenero'
                    const isAdminActing = auth.role === 'ADMINISTRADOR'

                    const actingFor = auth.role === 'ADMINISTRADOR'
                      ? (() => {
                          if (_idx === 0) return 'Jefe de Oficina'
                          return 'Almacenero'
                        })()
                      : null

                    return (
                      <div key={auth.id} className={`flex items-center gap-3 p-3 border rounded-lg ${
                        isAdminActing ? 'bg-purple-50 border-purple-200' : 'bg-green-50 border-green-200'
                      }`}>
                        <CheckCircle className={`h-5 w-5 ${isAdminActing ? 'text-purple-600' : 'text-green-600'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`font-medium ${isAdminActing ? 'text-purple-800' : 'text-green-800'}`}>
                              {auth.user.fullName}
                            </p>
                            {isAdminActing && (
                              <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300 text-xs whitespace-nowrap">
                                Administrador
                              </Badge>
                            )}
                          </div>
                          <p className={`text-sm ${isAdminActing ? 'text-purple-600' : 'text-green-600'}`}>
                            {isAdminActing ? 'Administrador' : displayRole} • {new Date(auth.authorizedAt).toLocaleDateString('es-PE')} a las {new Date(auth.authorizedAt).toLocaleTimeString('es-PE')}
                          </p>
                          {isAdminActing && actingFor && (
                            <p className="text-xs text-purple-500 mt-1 flex items-center gap-1">
                              <span>✦</span>
                              <span>Autorización emitida por el Administrador en representación de <strong>{actingFor}</strong></span>
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <Separator />

            <OrderAuthorizationPanel
              order={order}
              user={user}
              config={config}
              onActionComplete={onActionComplete}
              onOrderUpdated={onOrderUpdated}
              onDialogClose={() => onOpenChange(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
