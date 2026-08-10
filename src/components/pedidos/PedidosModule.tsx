'use client'

import { useMemo, useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Toggle } from '@/components/ui/toggle'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useConfigStore, useAuthStore } from '@/store'
import { Plus, Search, Eye, AlertCircle, Building, Trash2, LayoutGrid, List } from 'lucide-react'
import type { Order, OrderItem } from '@/types'
import { toast } from 'sonner'
import { normalizeText } from '@/lib/utils'
import { useApiQuery, useApiMutation, queryKeys, useInvalidateQueries } from '@/hooks/use-api-query'
import { useDebounce } from '@/hooks/use-debounce'
import { AnimatedContainer } from '@/components/ui/animated-container'
import { OrderStatusBadge } from './order-status-badge'
import { OrderFormDialog } from './order-form-dialog'
import { OrderViewDialog } from './order-view-dialog'
import { OrderKanbanView } from './order-kanban'

export function PedidosModule() {
  const config = useConfigStore(s => s.config)
  const user = useAuthStore(s => s.user)
  const { invalidate } = useInvalidateQueries()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false)
  const [viewOrderOpen, setViewOrderOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list')

  const debouncedSearch = useDebounce(search, 300)

  const statusParams = statusFilter !== 'all' ? { status: statusFilter } : undefined
  const { data: ordersData, isLoading } = useApiQuery<{ orders: Order[] }>(
    queryKeys.orders,
    statusParams,
    { staleTime: 30000 }
  )
  const orders = ordersData?.orders || []

  const deleteMutation = useApiMutation<{ id: number }, { message: string }>(
    'DELETE',
    '',
    {
      onSuccess: () => invalidate([queryKeys.orders]),
    }
  )

  const handleDeleteClick = (order: Order) => {
    setOrderToDelete(order)
    setDeleteConfirmOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return
    deleteMutation.mutate(
      { id: orderToDelete.id },
      {
        onSuccess: () => {
          toast.success('Pedido eliminado correctamente')
          setDeleteConfirmOpen(false)
          setOrderToDelete(null)
        },
        onError: () => {
          toast.error('Error al eliminar el pedido')
        }
      }
    )
  }

  const canDelete = useCallback((order: Order) => {
    return (user?.role === 'ADMINISTRADOR' || order.requestedById === user?.id) &&
           order.status === 'PENDIENTE'
  }, [user])

  const filteredOrders = useMemo(() => {
    if (!debouncedSearch) return orders
    const q = normalizeText(debouncedSearch)
    return orders.filter(order =>
      normalizeText(order.orderNumber).includes(q) ||
      normalizeText(order.requestedBy.fullName).includes(q)
    )
  }, [orders, debouncedSearch])

  const overduePatrimonials = useMemo(() => {
    const overdue: Array<{
      order: Order
      orderItem: OrderItem
      daysOverdue: number
    }> = []

    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    for (const order of orders) {
      if (order.status !== 'COMPLETADO') continue
      for (const oi of order.items) {
        if (oi.item.itemType !== 'PATRIMONIAL' || oi.actualReturnDate) continue
        const expectedReturn = oi.expectedReturnDate ? new Date(oi.expectedReturnDate).getTime() : null
        const issueDate = oi.issueDate ? new Date(oi.issueDate).getTime() : new Date(order.createdAt).getTime()

        if (expectedReturn) {
          const daysOverdue = Math.floor((now - expectedReturn) / (1000 * 60 * 60 * 24))
          if (daysOverdue > 0) overdue.push({ order, orderItem: oi, daysOverdue })
        } else {
          const daysSinceIssue = Math.floor((now - issueDate) / (1000 * 60 * 60 * 24))
          if (daysSinceIssue > 15) overdue.push({ order, orderItem: oi, daysOverdue: daysSinceIssue - 15 })
        }
      }
    }

    return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue)
  }, [orders])

  const isAlertVisible = overduePatrimonials.length > 0 &&
    (user?.role === 'ALMACENERO' || user?.role === 'ADMINISTRADOR')

  return (
    <AnimatedContainer className="space-y-6">
      {isAlertVisible && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              Bienes Patrimoniales Pendientes de Retorno
            </CardTitle>
            <CardDescription className="text-red-700">
              {overduePatrimonials.length} bien(es) con fecha de retorno vencida
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-48 overflow-y-auto space-y-2">
              {overduePatrimonials.slice(0, 5).map(({ order, orderItem, daysOverdue }) => (
                <div
                  key={`${order.id}-${orderItem.id}`}
                  className="flex items-center justify-between p-2 bg-white rounded border border-red-200"
                >
                  <div>
                    <p className="font-medium text-sm">{orderItem.item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-mono">{orderItem.item.patrimonialCode || 'S/N'}</span>
                      {' • '}
                      Pedido: {order.orderNumber}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="whitespace-nowrap">
                      {daysOverdue} días vencido
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedOrder(order)
                        setViewOrderOpen(true)
                      }}
                    >
                      Ver
                    </Button>
                  </div>
                </div>
              ))}
              {overduePatrimonials.length > 5 && (
                <p className="text-sm text-red-700 text-center">
                  ...y {overduePatrimonials.length - 5} más
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Gestión de Pedidos</h1>
          <p className="text-muted-foreground">Solicitudes de salida de bienes del almacén</p>
        </div>
        <OrderFormDialog
          open={isNewOrderOpen}
          onOpenChange={setIsNewOrderOpen}
          onOrderCreated={() => invalidate([queryKeys.orders])}
          trigger={
            <Button style={{ backgroundColor: config?.primaryColor }}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Pedido
            </Button>
          }
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número o solicitante..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="AUTORIZADO_JEFE">Autorizado Jefe</SelectItem>
                <SelectItem value="AUTORIZADO_ALMACENERO">Listo para Entrega</SelectItem>
                <SelectItem value="COMPLETADO">Entregado</SelectItem>
                <SelectItem value="RECHAZADO">Rechazado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <div className="inline-flex items-center border rounded-lg overflow-hidden">
          <Toggle pressed={viewMode === 'list'} onPressedChange={() => setViewMode('list')} aria-label="Vista lista">
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </Toggle>
          <Toggle pressed={viewMode === 'kanban'} onPressedChange={() => setViewMode('kanban')} aria-label="Vista kanban">
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Kanban</span>
          </Toggle>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        <OrderKanbanView
          orders={filteredOrders}
          onViewOrder={(order) => {
            setSelectedOrder(order)
            setViewOrderOpen(true)
          }}
        />
      ) : (
      <Card>
        <div className="overflow-x-auto">
          <Table responsiveCards>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Solicitante</TableHead>
              <TableHead hideOnMobile>Oficina</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead hideOnMobile>Fecha</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8">
                  Cargando...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No se encontraron pedidos
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono font-medium">{order.orderNumber}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{order.requestedBy.fullName}</p>
                      <p className="text-xs text-muted-foreground">{order.requestedBy.position}</p>
                    </div>
                  </TableCell>
                  <TableCell hideOnMobile>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {order.office.name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{order.items?.length || 0} items</Badge>
                  </TableCell>
                  <TableCell><OrderStatusBadge status={order.status} /></TableCell>
                  <TableCell hideOnMobile className="text-sm">
                    {new Date(order.createdAt).toLocaleDateString('es-PE')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedOrder(order)
                          setViewOrderOpen(true)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {canDelete(order) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500"
                          onClick={() => handleDeleteClick(order)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </div>
      </Card>
      )}

      <OrderViewDialog
        open={viewOrderOpen}
        onOpenChange={setViewOrderOpen}
        order={selectedOrder}
        user={user}
        onActionComplete={() => invalidate([queryKeys.orders])}
        onOrderUpdated={(updated) => setSelectedOrder(updated)}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de eliminar el pedido <strong>{orderToDelete?.orderNumber}</strong>?
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AnimatedContainer>
  )
}