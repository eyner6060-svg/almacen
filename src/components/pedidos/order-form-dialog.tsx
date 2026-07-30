'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useConfigStore, useAuthStore, useOrdersStore } from '@/store'
import { useCartStore } from '@/store'
import { ShoppingCart, Package, Plus, Search, Clock, Check, Trash2, MapPin, PackageCheck } from 'lucide-react'
import type { Item } from '@/types'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/http'
import { normalizeText } from '@/lib/utils'

interface OrderFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onOrderCreated: () => void
  trigger?: React.ReactNode
}

export function OrderFormDialog({ open, onOpenChange, onOrderCreated, trigger }: OrderFormDialogProps) {
  const { config } = useConfigStore()
  const { user } = useAuthStore()
  const { addOrder } = useOrdersStore()
  const { items: cartItems, addItem: addToCart, removeItem: removeFromCart, updateQuantity, updateLocation, clearCart } = useCartStore()

  const [catalogItems, setCatalogItems] = useState<Item[]>([])
  const [notes, setNotes] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const [patrimonialSelectOpen, setPatrimonialSelectOpen] = useState(false)
  const [selectedPatrimonialItem, setSelectedPatrimonialItem] = useState<Item | null>(null)
  const [patrimonialLocation, setPatrimonialLocation] = useState('')

  useEffect(() => {
    if (!open) return
    apiFetch('/api/items?perPage=500&view=detail&hideUnavailablePatrimonial=true').then(res => {
      if (res.ok) res.json().then(data =>
        setCatalogItems((data.items ?? []).filter((i: { quantity: number; itemType: string; patrimonialUnits?: { isAvailable: boolean }[] }) =>
          i.itemType !== 'CONSUMIBLE' || i.quantity > 0
        ))
      )
    }).catch(() => {})
  }, [open])

  const filteredItemsForCart = catalogItems.filter(item =>
    normalizeText(item.name).includes(normalizeText(itemSearch)) ||
    normalizeText(item.code).includes(normalizeText(itemSearch)) ||
    (normalizeText(item.patrimonialCode ?? '').includes(normalizeText(itemSearch)) ?? false)
  )

  const handleAddToCart = (item: Item) => {
    if (item.itemType === 'PATRIMONIAL' && item.patrimonialUnits && item.patrimonialUnits.length > 0) {
      setSelectedPatrimonialItem(item)
      setPatrimonialSelectOpen(true)
    } else if (item.itemType === 'PATRIMONIAL') {
      addToCart(item, 1, null, item.patrimonialCode)
      toast.success(`"${item.name}" agregado al pedido`)
    } else {
      addToCart(item, 1)
      toast.success(`"${item.name}" agregado al pedido`)
    }
  }

  const handleSelectPatrimonialUnit = (unit: { id: number; patrimonialCode: string }) => {
    if (selectedPatrimonialItem) {
      addToCart(selectedPatrimonialItem, 1, unit.id, unit.patrimonialCode, patrimonialLocation || null)
      toast.success(`"${selectedPatrimonialItem.name}" (${unit.patrimonialCode}) agregado al pedido`)
    }
    setPatrimonialSelectOpen(false)
    setSelectedPatrimonialItem(null)
    setPatrimonialLocation('')
  }

  const handleAddAnyPatrimonialUnit = () => {
    if (selectedPatrimonialItem && selectedPatrimonialItem.patrimonialUnits && selectedPatrimonialItem.patrimonialUnits.length > 0) {
      const alreadySelected = cartItems.map(ci => ci.patrimonialUnitId)
      const availableUnit = selectedPatrimonialItem.patrimonialUnits.find(u => u.isAvailable && !alreadySelected.includes(u.id))
      if (availableUnit) {
        addToCart(selectedPatrimonialItem, 1, availableUnit.id, availableUnit.patrimonialCode, patrimonialLocation || null)
        toast.success(`"${selectedPatrimonialItem.name}" (${availableUnit.patrimonialCode}) agregado al pedido`)
      }
    }
    setPatrimonialSelectOpen(false)
    setSelectedPatrimonialItem(null)
    setPatrimonialLocation('')
  }

  const handleCreateOrder = async () => {
    if (cartItems.length === 0) {
      toast.error('Agregue al menos un bien al pedido')
      return
    }

    const officeIdValue = user?.officeId
    if (!officeIdValue) {
      toast.error('No se pudo determinar su oficina')
      setIsProcessing(false)
      return
    }

    setIsProcessing(true)
    try {
      const response = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: cartItems.map(ci => {
            const item: Record<string, unknown> = {
              itemId: ci.item.id,
              quantity: ci.quantity,
            }
            if (ci.patrimonialUnitId != null) item.patrimonialUnitId = ci.patrimonialUnitId
            if (ci.patrimonialCode != null) item.patrimonialCode = ci.patrimonialCode
            return item
          }),
          notes,
          officeId: officeIdValue,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        addOrder(data.order)
        clearCart()
        setNotes('')
        setIsProcessing(false)
        onOpenChange(false)
        toast.success('Pedido creado correctamente. Espere la autorización del Jefe de Oficina.')
        onOrderCreated()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Error al crear el pedido')
        setIsProcessing(false)
      }
    } catch {
      toast.error('Error al crear el pedido')
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) { clearCart(); setNotes('') }
      onOpenChange(newOpen)
    }}>
      {trigger && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent
        className="flex flex-col p-0 gap-0 overflow-y-auto xl:overflow-hidden w-[95vw] max-w-[95vw] md:max-w-[98vw] lg:max-w-[1600px] h-auto max-h-[90vh] sm:max-h-[95vh]"
      >
        <DialogHeader className="px-5 py-4 border-b flex-shrink-0 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: config?.primaryColor || '#1e40af' }}>
                <ShoppingCart className="h-5 w-5 text-white" />
              </div>
              <div className="space-y-1">
                <DialogTitle className="text-xl font-bold text-slate-900">
                  Nuevo pedido de salida
                </DialogTitle>
                <DialogDescription className="text-slate-500 text-sm">
                  Seleccione bienes y cantidades del catálogo
                </DialogDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-sm font-medium px-3 py-1.5">
              {cartItems.length} items
            </Badge>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-0 flex-1 overflow-y-auto xl:overflow-hidden">
          {/* Catálogo de Bienes */}
          <div className="flex flex-col border-r bg-white xl:col-span-3 min-h-[300px] xl:min-h-0">
            <div className="px-4 py-2 border-b bg-slate-50 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-slate-500" />
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Catálogo de Bienes</h3>
                </div>
                <span className="text-xs text-slate-400">
                  {filteredItemsForCart.filter(i => i.quantity > 0).length} disponibles
                </span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nombre, código o categoría..."
                  className="pl-9 h-9 bg-white text-sm"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] xl:min-h-[300px]">
              {filteredItemsForCart.filter(i => i.quantity > 0).length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <Package className="h-8 w-8 mx-auto mb-1 opacity-40" />
                  <p className="font-medium text-slate-500 text-xs">No hay bienes disponibles</p>
                </div>
              ) : (
                filteredItemsForCart.filter(i => i.quantity > 0).map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 border rounded-lg hover:bg-slate-50 transition-colors">
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="font-medium text-slate-800 text-sm truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 font-mono">{item.code}</span>
                        {item.itemType === 'PATRIMONIAL' ? (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-amber-50 text-amber-700 border-amber-200">
                            {item.patrimonialCode?.substring(0, 7) || 'S/N'}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-green-50 text-green-700 border-green-200">
                            Consumible
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        Stock: {item.quantity}
                      </span>
                      <Button
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => handleAddToCart(item)}
                        disabled={item.quantity === 0}
                        style={{ backgroundColor: config?.primaryColor }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Carrito */}
          <div className="flex flex-col bg-slate-50 xl:col-span-2 min-h-[250px] xl:min-h-0">
            <div className="px-4 py-2 border-b bg-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-slate-500" />
                  <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Carrito</h3>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {cartItems.length} items
                </Badge>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[150px] xl:min-h-[200px]">
              {cartItems.length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <ShoppingCart className="h-6 w-6 mx-auto mb-1 opacity-40" />
                  <p className="font-medium text-slate-500 text-xs">Carrito vacío</p>
                </div>
              ) : (
                cartItems.map((ci, idx) => (
                  <div key={`${ci.item.id}-${ci.patrimonialUnitId || idx}`} className="p-2 bg-white rounded-lg border">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm truncate">{ci.item.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{ci.item.code}</p>
                        <p className="text-xs text-amber-600 font-mono mt-0.5">{ci.patrimonialCode || 'S/N'}</p>
                        {ci.item.itemType === 'PATRIMONIAL' && (
                          <Input
                            placeholder="Ubicación destino..."
                            value={ci.location || ''}
                            onChange={(e) => updateLocation(ci.item.id, ci.patrimonialUnitId ?? null, e.target.value)}
                            className="h-7 text-xs mt-2"
                          />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {ci.item.itemType === 'PATRIMONIAL' ? (
                          <span className="w-6 text-center text-sm font-medium">1</span>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 text-xs"
                              onClick={() => updateQuantity(ci.item.id, Math.max(1, ci.quantity - 1))}
                            >
                              -
                            </Button>
                            <span className="w-6 text-center text-sm font-medium">{ci.quantity}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0 text-xs"
                              onClick={() => updateQuantity(ci.item.id, Math.min(ci.item.quantity, ci.quantity + 1))}
                            >
                              +
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:bg-red-50 ml-1"
                          onClick={() => removeFromCart(ci.item.id, ci.patrimonialUnitId ?? null)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Oficina y Notas */}
            <div className="p-3 border-t bg-white space-y-3">
              <div>
                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wider">Notas / Observaciones</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observaciones del pedido..."
                    className="h-9 mt-1 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pie de página */}
        <div className="px-5 py-4 border-t bg-white flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-slate-600">
            Total: <strong className="text-base">{cartItems.length}</strong> bienes seleccionados
          </span>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="px-5"
              onClick={() => { clearCart(); onOpenChange(false) }}
            >
              Cancelar
            </Button>
            <Button
              className="px-5"
              onClick={handleCreateOrder}
              style={{ backgroundColor: config?.primaryColor }}
              disabled={cartItems.length === 0 || isProcessing}
            >
              {isProcessing ? (
                <Clock className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Crear pedido
            </Button>
          </div>
        </div>

        {/* Diálogo de selección de unidad patrimonial */}
        <Dialog open={patrimonialSelectOpen} onOpenChange={(open) => {
          setPatrimonialSelectOpen(open)
          if (!open) setPatrimonialLocation('')
        }}>
          <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Seleccionar Unidad Patrimonial</DialogTitle>
              <DialogDescription>
                {selectedPatrimonialItem?.name} - Seleccione una unidad específica o agregue cualquiera disponible
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Ubicación del Bien (Opcional)
                </Label>
                <Input
                  placeholder="Ej: Oficina de Sistemas, Escritorio 12..."
                  value={patrimonialLocation}
                  onChange={(e) => setPatrimonialLocation(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Indique dónde se ubicará el bien patrimonial
                </p>
              </div>

              <Button
                className="w-full"
                variant="outline"
                onClick={handleAddAnyPatrimonialUnit}
                style={{ borderColor: config?.primaryColor }}
              >
                <PackageCheck className="h-4 w-4 mr-2" />
                Agregar cualquiera disponible
              </Button>

              <div className="text-center text-sm text-muted-foreground">o seleccione una específica:</div>

              <div className="max-h-60 overflow-y-auto space-y-2">
                {selectedPatrimonialItem?.patrimonialUnits
                  ?.filter(u => u.isAvailable && !cartItems.some(ci => ci.patrimonialUnitId === u.id))
                  .map((unit) => (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                      onClick={() => handleSelectPatrimonialUnit(unit)}
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono">
                          {unit.patrimonialCode}
                        </Badge>
                        <Badge className={unit.status === 'OPERATIVO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                          {unit.status}
                        </Badge>
                      </div>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
              </div>

              {selectedPatrimonialItem?.patrimonialUnits?.filter(u => u.isAvailable).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  No hay unidades disponibles
                </p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  )
}
